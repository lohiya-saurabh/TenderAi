/**
 * SettingsService — Manages tenant workspace settings and notification preferences.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { BadRequestError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

export interface NotificationPreferences {
  notifyDeadlines: boolean;
  notifyEvidenceExpiry: boolean;
  notifyReviewRequests: boolean;
  notifyHighRiskFlags: boolean;
}

export interface WorkspaceSettingsView {
  organizationId: string;
  organizationName: string;
  defaultCompanyId: string | null;
  notificationPreferences: NotificationPreferences;
  updatedAt: string;
}

export interface UpdateWorkspaceSettingsDto {
  defaultCompanyId?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
}

@Injectable()
export class SettingsService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Get workspace settings for the caller's tenant.
   */
  public async getWorkspaceSettings(): Promise<WorkspaceSettingsView> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId;

    let orgName = 'Default Workspace';
    if (userId) {
      const [userRec] = await this.db
        .select({ organizationName: schema.users.organizationName })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (userRec?.organizationName) {
        orgName = userRec.organizationName;
      }
    }

    const [record] = await this.db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.organizationId, orgId))
      .limit(1);

    if (!record) {
      // Auto-provision default settings on first access
      const defaultPrefs: NotificationPreferences = {
        notifyDeadlines: true,
        notifyEvidenceExpiry: true,
        notifyReviewRequests: true,
        notifyHighRiskFlags: true,
      };

      const now = new Date();
      const id = `tset_${orgId}`;

      const [created] = await this.db
        .insert(schema.tenantSettings)
        .values({
          id,
          organizationId: orgId,
          defaultCompanyId: null,
          notificationPreferences: defaultPrefs,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();

      return {
        organizationId: orgId,
        organizationName: orgName,
        defaultCompanyId: created?.defaultCompanyId ?? null,
        notificationPreferences: created?.notificationPreferences ?? defaultPrefs,
        updatedAt: (created?.updatedAt ?? now).toISOString(),
      };
    }

    return {
      organizationId: record.organizationId,
      organizationName: orgName,
      defaultCompanyId: record.defaultCompanyId ?? null,
      notificationPreferences: record.notificationPreferences,
      updatedAt:
        record.updatedAt instanceof Date
          ? record.updatedAt.toISOString()
          : String(record.updatedAt),
    };
  }

  /**
   * Update workspace settings and notification preferences for caller's tenant.
   */
  public async updateWorkspaceSettings(
    dto: UpdateWorkspaceSettingsDto,
  ): Promise<WorkspaceSettingsView> {
    const orgId = this.requireOrg();
    const current = await this.getWorkspaceSettings();

    const mergedPrefs: NotificationPreferences = {
      ...current.notificationPreferences,
      ...(dto.notificationPreferences || {}),
    };

    const updates: Partial<schema.NewTenantSetting> = {
      notificationPreferences: mergedPrefs,
      updatedAt: new Date(),
    };

    if (dto.defaultCompanyId !== undefined) {
      updates.defaultCompanyId = dto.defaultCompanyId.trim() || null;
    }

    await this.db
      .insert(schema.tenantSettings)
      .values({
        id: `tset_${orgId}`,
        organizationId: orgId,
        defaultCompanyId: updates.defaultCompanyId ?? null,
        notificationPreferences: mergedPrefs,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.tenantSettings.organizationId,
        set: updates,
      });

    return this.getWorkspaceSettings();
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required.');
    }
    return orgId;
  }
}
