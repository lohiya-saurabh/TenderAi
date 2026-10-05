/**
 * Notifications API Client
 */
import { apiGet, apiPatch, apiPost, type ApiResult } from './client.js';

export type NotificationCategory =
  | 'DEADLINE'
  | 'EVIDENCE_EXPIRY'
  | 'REVIEW_REQUEST'
  | 'HIGH_RISK_FLAG'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface NotificationItem {
  id: string;
  organizationId: string;
  recipientUserId: string | null;
  recipientEmail: string | null;
  category: NotificationCategory;
  channel: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export function listNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<ApiResult<NotificationsListResponse>> {
  const query = new URLSearchParams();
  if (params?.unreadOnly) query.set('unreadOnly', 'true');
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<NotificationsListResponse>(`/api/v1/notifications${qs ? `?${qs}` : ''}`);
}

export function markNotificationAsRead(id: string): Promise<ApiResult<NotificationItem>> {
  return apiPatch<NotificationItem>(`/api/v1/notifications/${id}/read`, {});
}

export function markAllNotificationsAsRead(): Promise<ApiResult<{ success: boolean; count: number }>> {
  return apiPost<{ success: boolean; count: number }>('/api/v1/notifications/mark-all-read', {});
}

export function triggerNotificationScan(): Promise<ApiResult<{ scannedBids: number; notificationsCreated: number }>> {
  return apiPost<{ scannedBids: number; notificationsCreated: number }>('/api/v1/notifications/trigger-scan', {});
}
