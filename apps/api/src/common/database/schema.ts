/**
 * Drizzle ORM Schema definition for TenderPulse AI PostgreSQL database.
 * Single source of truth for compile-time types and query building.
 */
import { pgTable, text, integer, bigint, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  organizationId: text('organization_id').notNull(),
  organizationName: text('organization_name').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const bids = pgTable('bids', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  title: text('title').notNull(),
  tenderNumber: text('tender_number').notNull(),
  tenderingAuthority: text('tendering_authority').notNull(),
  estimatedValueRupees: bigint('estimated_value_rupees', { mode: 'number' }).notNull(),
  submissionDeadline: text('submission_deadline'),
  status: text('status').notNull().default('DRAFT'),
  totalRequirements: integer('total_requirements').notNull().default(0),
  flaggedRequirements: integer('flagged_requirements').notNull().default(0),
  approvedRequirements: integer('approved_requirements').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Bid = typeof bids.$inferSelect;
export type NewBid = typeof bids.$inferInsert;

export const tenderDocuments = pgTable('tender_documents', {
  id: text('id').primaryKey(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull(),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  documentType: text('document_type').notNull(),
  status: text('status').notNull().default('UPLOADED'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenderDocument = typeof tenderDocuments.$inferSelect;
export type NewTenderDocument = typeof tenderDocuments.$inferInsert;

export const complianceItems = pgTable('compliance_items', {
  id: text('id').primaryKey(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('PENDING'),
  humanReviewRequired: boolean('human_review_required').notNull().default(true),
  reviewNotes: text('review_notes'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  executionRules: jsonb('execution_rules').notNull(),
  provenance: jsonb('provenance').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;
export type NewComplianceItem = typeof complianceItems.$inferInsert;

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  bidId: text('bid_id').notNull(),
  organizationId: text('organization_id').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  eventType: text('event_type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
