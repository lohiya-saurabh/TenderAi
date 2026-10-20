import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, tstzNow, createdAt } from './helpers.js';
import { organizations } from './tenants.js';
import { users } from './auth.js';

export const documentProcessingOutbox = pgTable('document_processing_outbox', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: tstzNow('next_attempt_at'),
  lockedAt: tstz('locked_at'),
  lastError: text('last_error'),
  createdAt: createdAt(),
  publishedAt: tstz('published_at'),
});

export type DocumentProcessingOutboxRecord = typeof documentProcessingOutbox.$inferSelect;

export const auditLogs = pgTable('audit_logs', {
  id: pk(),
  bidId: text('bid_id').notNull(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  eventType: text('event_type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: tstzNow('timestamp'),
});

export type AuditLog = typeof auditLogs.$inferSelect;

export const notifications = pgTable('notifications', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  recipientUserId: text('recipient_user_id').references(() => users.id, { onDelete: 'cascade' }),
  recipientEmail: text('recipient_email'),
  category: text('category').notNull(),
  channel: text('channel').notNull().default('IN_APP'),
  priority: text('priority').notNull().default('MEDIUM'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: createdAt(),
  readAt: tstz('read_at'),
});

export type Notification = typeof notifications.$inferSelect;
