/**
 * NotificationsService — Manages in-app & outbound notification lifecycle,
 * preference gating, and automated deadline monitoring.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import type {
  SendNotificationDto,
  NotificationResponse,
  NotificationsListResponse,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
} from './notifications.types.js';

@Injectable()
export class NotificationsService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * List notifications for the authenticated user and tenant.
   */
  public async listNotifications(params?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<NotificationsListResponse> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId;

    const limit = Math.min(params?.limit || 50, 100);

    // Build query conditions
    const conditions = [eq(schema.notifications.organizationId, orgId)];

    if (params?.unreadOnly) {
      conditions.push(eq(schema.notifications.isRead, false));
    }

    const records = await this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);

    // Filter to user-specific or broadcast notifications
    const userRecords = records.filter((r) => !r.recipientUserId || r.recipientUserId === userId);

    // Count total unread
    const [unreadResult] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.organizationId, orgId),
          eq(schema.notifications.isRead, false),
          userId
            ? sql`(${schema.notifications.recipientUserId} IS NULL OR ${schema.notifications.recipientUserId} = ${userId})`
            : sql`TRUE`,
        ),
      );

    const unreadCount = parseInt(unreadResult?.count || '0', 10);

    return {
      notifications: userRecords.map(this.mapRecord),
      unreadCount,
    };
  }

  /**
   * Mark a single notification as read.
   */
  public async markAsRead(id: string): Promise<NotificationResponse> {
    const orgId = this.requireOrg();

    const [existing] = await this.db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.organizationId, orgId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError(`Notification '${id}' not found.`);
    }

    const now = new Date();
    const [updated] = await this.db
      .update(schema.notifications)
      .set({ isRead: true, readAt: now })
      .where(eq(schema.notifications.id, id))
      .returning();

    return this.mapRecord(updated || existing);
  }

  /**
   * Mark all unread notifications for the user as read.
   */
  public async markAllAsRead(): Promise<{ success: boolean; count: number }> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId;

    const conditions = [
      eq(schema.notifications.organizationId, orgId),
      eq(schema.notifications.isRead, false),
    ];

    if (userId) {
      conditions.push(
        sql`(${schema.notifications.recipientUserId} IS NULL OR ${schema.notifications.recipientUserId} = ${userId})`,
      );
    }

    const updated = await this.db
      .update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(...conditions))
      .returning();

    return {
      success: true,
      count: updated.length,
    };
  }

  /**
   * Send / deliver a notification, strictly gated by tenant_settings preferences.
   */
  public async sendNotification(
    dto: SendNotificationDto,
  ): Promise<{ delivered: boolean; reason?: string; notification?: NotificationResponse }> {
    const orgId = this.requireOrg();
    const callerUserId = TenantContextHolder.get()?.userId;

    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestError('Notification title is required.');
    }
    if (!dto.message || !dto.message.trim()) {
      throw new BadRequestError('Notification message is required.');
    }

    // 1. Preference Gating via tenant_settings
    const [settings] = await this.db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.organizationId, orgId))
      .limit(1);

    const prefs = settings?.notificationPreferences ?? {
      notifyDeadlines: true,
      notifyEvidenceExpiry: true,
      notifyReviewRequests: true,
      notifyHighRiskFlags: true,
    };

    if (dto.category === 'DEADLINE' && !prefs.notifyDeadlines) {
      return {
        delivered: false,
        reason: 'SUPPRESSED_BY_TENANT_PREFERENCES (notifyDeadlines=false)',
      };
    }
    if (dto.category === 'EVIDENCE_EXPIRY' && !prefs.notifyEvidenceExpiry) {
      return {
        delivered: false,
        reason: 'SUPPRESSED_BY_TENANT_PREFERENCES (notifyEvidenceExpiry=false)',
      };
    }
    if (dto.category === 'REVIEW_REQUEST' && !prefs.notifyReviewRequests) {
      return {
        delivered: false,
        reason: 'SUPPRESSED_BY_TENANT_PREFERENCES (notifyReviewRequests=false)',
      };
    }
    if (dto.category === 'HIGH_RISK_FLAG' && !prefs.notifyHighRiskFlags) {
      return {
        delivered: false,
        reason: 'SUPPRESSED_BY_TENANT_PREFERENCES (notifyHighRiskFlags=false)',
      };
    }

    // 2. Persist notification into PostgreSQL
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const [created] = await this.db
      .insert(schema.notifications)
      .values({
        id: notificationId,
        organizationId: orgId,
        recipientUserId: dto.recipientUserId ?? callerUserId ?? null,
        recipientEmail: dto.recipientEmail ?? null,
        category: dto.category,
        channel: dto.channel || 'IN_APP',
        priority: dto.priority || 'MEDIUM',
        title: dto.title.trim(),
        message: dto.message.trim(),
        metadata: dto.metadata ?? null,
        isRead: false,
        createdAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new BadRequestError('Failed to create notification.');
    }

    return {
      delivered: true,
      notification: this.mapRecord(created),
    };
  }

  /**
   * Automated scanner that checks for imminent tender deadlines (< 7 days)
   * and expiring certifications, generating actionable notifications.
   */
  public async triggerDeadlineAndExpiryScan(): Promise<{
    scannedBids: number;
    notificationsCreated: number;
  }> {
    const orgId = this.requireOrg();

    // 1. Scan active bids
    const activeBids = await this.db
      .select({
        id: schema.bids.id,
        title: schema.bids.title,
        tenderNumber: schema.bids.tenderNumber,
        submissionDeadline: schema.bids.submissionDeadline,
      })
      .from(schema.bids)
      .where(
        and(
          eq(schema.bids.organizationId, orgId),
          sql`${schema.bids.submissionDeadline} IS NOT NULL`,
        ),
      );

    let createdCount = 0;
    const now = new Date();

    for (const bid of activeBids) {
      if (!bid.submissionDeadline) continue;
      const deadlineDate = new Date(bid.submissionDeadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // If deadline is within 7 days and in the future
      if (diffDays >= 0 && diffDays <= 7) {
        const result = await this.sendNotification({
          category: 'DEADLINE',
          priority: diffDays <= 2 ? 'URGENT' : 'HIGH',
          title: `Submission Deadline in ${diffDays} Day${diffDays === 1 ? '' : 's'}: ${bid.tenderNumber || bid.title}`,
          message: `Bid "${bid.title}" deadline expires on ${deadlineDate.toLocaleDateString('en-IN')}. Please finalize all compliance items.`,
          metadata: { bidId: bid.id, daysLeft: diffDays },
        });

        if (result.delivered) {
          createdCount++;
        }
      }
    }

    return {
      scannedBids: activeBids.length,
      notificationsCreated: createdCount,
    };
  }

  private mapRecord(r: typeof schema.notifications.$inferSelect): NotificationResponse {
    return {
      id: r.id,
      organizationId: r.organizationId,
      recipientUserId: r.recipientUserId ?? null,
      recipientEmail: r.recipientEmail ?? null,
      category: r.category as NotificationCategory,
      channel: r.channel as NotificationChannel,
      priority: r.priority as NotificationPriority,
      title: r.title,
      message: r.message,
      metadata: (r.metadata as Record<string, unknown>) ?? null,
      isRead: Boolean(r.isRead),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required for notifications.');
    }
    return orgId;
  }
}
