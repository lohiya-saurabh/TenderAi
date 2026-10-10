/**
 * Drizzle ORM Schema definition for TenderPulse AI PostgreSQL database.
 * Single source of truth for compile-time types and query building.
 */
import { pgTable, text, integer, bigint, timestamp, boolean, jsonb, real } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  organizationId: text('organization_id').notNull(),
  organizationName: text('organization_name').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const tenantSettings = pgTable('tenant_settings', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').unique().notNull(),
  defaultCompanyId: text('default_company_id'),
  notificationPreferences: jsonb('notification_preferences').notNull().$type<{
    notifyDeadlines: boolean;
    notifyEvidenceExpiry: boolean;
    notifyReviewRequests: boolean;
    notifyHighRiskFlags: boolean;
  }>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenantSetting = typeof tenantSettings.$inferSelect;
export type NewTenantSetting = typeof tenantSettings.$inferInsert;

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  legalName: text('legal_name').notNull(),
  slug: text('slug'),
  gstin: text('gstin'),
  pan: text('pan'),
  udyamId: text('udyam_id'),
  constitution: text('constitution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export const bids = pgTable('bids', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  companyId: text('company_id').notNull(),
  title: text('title').notNull(),
  tenderNumber: text('tender_number').notNull(),
  tenderingAuthority: text('tendering_authority').notNull(),
  estimatedValueRupees: bigint('estimated_value_rupees', { mode: 'number' }).notNull(),
  submissionDeadline: text('submission_deadline'),
  locationState: text('location_state'),
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
  processingAttempts: integer('processing_attempts').notNull().default(0),
  processingStartedAt: timestamp('processing_started_at', { withTimezone: true }),
  processingCompletedAt: timestamp('processing_completed_at', { withTimezone: true }),
  lastProcessingError: text('last_processing_error'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenderDocument = typeof tenderDocuments.$inferSelect;
export type NewTenderDocument = typeof tenderDocuments.$inferInsert;

export interface ComplianceItemProvenance {
  documentId?: string | null;
  sourceDocumentId?: string | null;
  documentName?: string | null;
  sourceFileName?: string | null;
  pageNumber?: number | null;
  clauseReference?: string | null;
  sectionOrClause?: string | null;
  verbatimQuote?: string | null;
  confidenceScore?: number | null;
}

export const complianceItems = pgTable('compliance_items', {
  id: text('id').primaryKey(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull(),
  companyId: text('company_id'),
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
  provenance: jsonb('provenance').notNull().$type<ComplianceItemProvenance>(),
  companyEvidence: jsonb('company_evidence'),
  risk: jsonb('risk'),
  rationale: jsonb('rationale'),
  workflowRunId: text('workflow_run_id'),
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;
export type NewComplianceItem = typeof complianceItems.$inferInsert;

export const documentProcessingOutbox = pgTable('document_processing_outbox', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  documentId: text('document_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export type DocumentProcessingOutboxRecord = typeof documentProcessingOutbox.$inferSelect;
export type NewDocumentProcessingOutboxRecord = typeof documentProcessingOutbox.$inferInsert;

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

// ---------------------------------------------------------------------------
// Company Capability Profile (pinned, versioned snapshots)
// ---------------------------------------------------------------------------

/**
 * Immutable company capability snapshot. The payload mirrors the AI engine's
 * CompanyProfileSnapshot contract (snake_case) so it can be passed through
 * to the bid-decision evaluation without mapping drift.
 */
export const companyProfileVersions = pgTable('company_profile_versions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  organizationId: text('organization_id').notNull(),
  version: integer('version').notNull(),
  name: text('name').notNull(),
  payload: jsonb('payload').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CompanyProfileVersion = typeof companyProfileVersions.$inferSelect;
export type NewCompanyProfileVersion = typeof companyProfileVersions.$inferInsert;

/**
 * Current pointer: one active profile version per company within an organization.
 */
export const companyProfiles = pgTable('company_profiles', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  organizationId: text('organization_id').notNull(),
  activeVersionId: text('active_version_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type NewCompanyProfile = typeof companyProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// Bid Decision audit trail
// ---------------------------------------------------------------------------

/**
 * Persisted bid/no-bid decision produced by the deterministic eligibility
 * engine. Immutable append-only record: every evaluation is kept for audit.
 */
export const bidDecisions = pgTable('bid_decisions', {
  id: text('id').primaryKey(),
  bidId: text('bid_id').notNull(),
  companyId: text('company_id'),
  organizationId: text('organization_id').notNull(),
  profileVersionId: text('profile_version_id').notNull(),
  verdict: text('verdict').notNull(),
  state: text('state').notNull(),
  readinessScore: real('readiness_score').notNull(),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BidDecision = typeof bidDecisions.$inferSelect;
export type NewBidDecision = typeof bidDecisions.$inferInsert;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  recipientUserId: text('recipient_user_id'),
  recipientEmail: text('recipient_email'),
  category: text('category').notNull(), // 'DEADLINE' | 'EVIDENCE_EXPIRY' | 'REVIEW_REQUEST' | 'HIGH_RISK_FLAG' | 'SYSTEM'
  channel: text('channel').notNull().default('IN_APP'), // 'IN_APP' | 'EMAIL' | 'SMS'
  priority: text('priority').notNull().default('MEDIUM'), // 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// ---------------------------------------------------------------------------
// Billing & Subscriptions (Tenant-level)
// ---------------------------------------------------------------------------

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').unique().notNull(),
  planTier: text('plan_tier').notNull().default('FREE'), // 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE'
  billingInterval: text('billing_interval').notNull().default('MONTHLY'), // 'MONTHLY' | 'ANNUAL'
  status: text('status').notNull().default('ACTIVE'), // 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const usageRecords = pgTable('usage_records', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  metric: text('metric').notNull(), // 'TENDER_ANALYSIS' | 'EVIDENCE_STORAGE_MB' | 'AI_RUN'
  quantity: integer('quantity').notNull().default(1),
  periodKey: text('period_key').notNull(), // 'YYYY-MM'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
