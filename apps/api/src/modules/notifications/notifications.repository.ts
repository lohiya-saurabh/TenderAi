/**
 * NotificationsRepository — Encapsulates database operations for notifications and preference lookups.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class NotificationsRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async listNotifications(
    orgId: string,
    params?: { unreadOnly?: boolean; limit?: number },
  ): Promise<schema.Notification[]> {
    const limit = Math.min(params?.limit || 50, 100);
    const conditions = [eq(schema.notifications.organizationId, orgId)];

    if (params?.unreadOnly) {
      conditions.push(eq(schema.notifications.isRead, false));
    }

    return this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
  }

  async countUnread(orgId: string, userId?: string): Promise<number> {
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

    return parseInt(unreadResult?.count || '0', 10);
  }

  async findById(id: string, orgId: string): Promise<schema.Notification | null> {
    const [existing] = await this.db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.organizationId, orgId)))
      .limit(1);

    return existing ?? null;
  }

  async markAsRead(id: string, readAt: Date): Promise<schema.Notification | null> {
    const [updated] = await this.db
      .update(schema.notifications)
      .set({ isRead: true, readAt })
      .where(eq(schema.notifications.id, id))
      .returning();

    return updated ?? null;
  }

  async markAllAsRead(orgId: string, userId: string | undefined, readAt: Date): Promise<schema.Notification[]> {
    const conditions = [
      eq(schema.notifications.organizationId, orgId),
      eq(schema.notifications.isRead, false),
    ];

    if (userId) {
      conditions.push(
        sql`(${schema.notifications.recipientUserId} IS NULL OR ${schema.notifications.recipientUserId} = ${userId})`,
      );
    }

    return this.db
      .update(schema.notifications)
      .set({ isRead: true, readAt })
      .where(and(...conditions))
      .returning();
  }

  async findTenantSettings(orgId: string): Promise<schema.TenantSetting | null> {
    const [settings] = await this.db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.organizationId, orgId))
      .limit(1);

    return settings ?? null;
  }

  async createNotification(
    data: typeof schema.notifications.$inferInsert,
  ): Promise<schema.Notification> {
    const [created] = await this.db
      .insert(schema.notifications)
      .values(data)
      .returning();

    if (!created) {
      throw new Error('Failed to create notification.');
    }
    return created;
  }

  async listActiveBidsWithDeadline(
    orgId: string,
  ): Promise<Array<{ id: string; title: string; tenderNumber: string | null; submissionDeadline: string | null }>> {
    return this.db
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
  }
}
