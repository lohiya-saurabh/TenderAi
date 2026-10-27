/**
 * Settings API Client
 */
import { apiGet, apiPatch, type ApiResult } from '@/api/client.js';

export interface NotificationPreferences {
  notifyDeadlines: boolean;
  notifyEvidenceExpiry: boolean;
  notifyReviewRequests: boolean;
  notifyHighRiskFlags: boolean;
}

export interface WorkspaceSettings {
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

export function getWorkspaceSettings(): Promise<ApiResult<WorkspaceSettings>> {
  return apiGet<WorkspaceSettings>('/api/v1/settings/workspace');
}

export function updateWorkspaceSettings(
  dto: UpdateWorkspaceSettingsDto,
): Promise<ApiResult<WorkspaceSettings>> {
  return apiPatch<WorkspaceSettings>('/api/v1/settings/workspace', dto);
}
