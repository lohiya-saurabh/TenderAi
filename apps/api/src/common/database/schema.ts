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
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  organizationId: text('organization_id').notNull(),
  organizationName: text('organization_name').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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
  companyId: text('company_id').notNull().default('comp_acme_infra_001'),
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
  companyEvidence: jsonb('company_evidence'),
  risk: jsonb('risk'),
  rationale: jsonb('rationale'),
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
  companyId: text('company_id').notNull().default('comp_acme_infra_001'),
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
