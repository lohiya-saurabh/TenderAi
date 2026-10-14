/**
 * Notification Types and DTOs for TenderPulse AI
 */

export type NotificationCategory =
  'DEADLINE' | 'EVIDENCE_EXPIRY' | 'REVIEW_REQUEST' | 'HIGH_RISK_FLAG' | 'SYSTEM';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface SendNotificationDto {
  recipientUserId?: string;
  recipientEmail?: string;
  category: NotificationCategory;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationResponse {
  id: string;
  organizationId: string;
  recipientUserId: string | null;
  recipientEmail: string | null;
  category: NotificationCategory;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsListResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
}
