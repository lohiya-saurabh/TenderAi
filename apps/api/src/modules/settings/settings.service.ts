/**
 * SettingsService — Manages tenant workspace settings and notification preferences.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { BadRequestError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { SettingsRepository } from '@/modules/settings/settings.repository.js';

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
  organizationName?: string;
  defaultCompanyId?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
}

@Injectable()
export class SettingsService {
  private readonly repository: SettingsRepository;

  constructor(
    @Inject(SettingsRepository)
    repositoryOrDb: SettingsRepository | DrizzleDb | PGlite,
  ) {
    this.repository =
      repositoryOrDb instanceof SettingsRepository
        ? repositoryOrDb
        : new SettingsRepository(repositoryOrDb);
  }

  /**
   * Get workspace settings for the caller's tenant.
   */
  public async getWorkspaceSettings(): Promise<WorkspaceSettingsView> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId;

    const orgNameFound = await this.repository.findOrganizationName(orgId);
    let orgName = orgNameFound ?? 'Default Workspace';

    if (!orgNameFound && userId) {
      const userOrgName = await this.repository.findUserOrganizationName(userId);
      if (userOrgName) {
        orgName = userOrgName;
      }
    }

    const record = await this.repository.findSettingsByOrganization(orgId);

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

      const created = await this.repository.createDefaultSettings({
        id,
        organizationId: orgId,
        defaultCompanyId: null,
        notificationPreferences: defaultPrefs,
        updatedAt: now,
      });

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

    await this.repository.upsertSettings(
      {
        id: `tset_${orgId}`,
        organizationId: orgId,
        defaultCompanyId: updates.defaultCompanyId ?? null,
        notificationPreferences: mergedPrefs,
        updatedAt: new Date(),
      },
      updates,
    );

    if (dto.organizationName !== undefined && dto.organizationName.trim()) {
      const newName = dto.organizationName.trim();
      const orgSlug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      await this.repository.upsertOrganization(orgId, newName, orgSlug);
      await this.repository.updateUsersOrganizationName(orgId, newName);
    }

    return this.getWorkspaceSettings();
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant organization context is required.');
    }
    return orgId;
  }
}
