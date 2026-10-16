import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, createdAt, updatedAt } from './helpers.js';
import { bids } from './bids.js';

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
  id: pk(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  organizationId: orgId(),
  companyId: text('company_id'),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('PENDING'),
  humanReviewRequired: boolean('human_review_required').notNull().default(true),
  reviewNotes: text('review_notes'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: tstz('reviewed_at'),
  version: integer('version').notNull().default(1),
  executionRules: jsonb('execution_rules').notNull(),
  provenance: jsonb('provenance').notNull().$type<ComplianceItemProvenance>(),
  companyEvidence: jsonb('company_evidence'),
  risk: jsonb('risk'),
  rationale: jsonb('rationale'),
  workflowRunId: text('workflow_run_id'),
  correlationId: text('correlation_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;
