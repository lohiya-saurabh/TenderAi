import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, createdAt, updatedAt } from './helpers.js';
import { bids } from './bids.js';
import { organizations } from './tenants.js';
import { companies } from './companies.js';
import type { ClauseAttributesDto } from '@tenderpulse/shared-types';

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
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
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
  // Phase 1 clause contract (null = not stated in the tender)
  documentId: text('document_id'),
  itemKey: text('item_key'),
  docOrder: integer('doc_order'),
  primaryPage: integer('primary_page'),
  supportingPages: jsonb('supporting_pages').$type<number[]>(),
  clauseRef: text('clause_ref'),
  sourceBlockId: text('source_block_id'),
  quoteCheck: text('quote_check').notNull().default('NO_PAGE_TEXT'),
  attributes: jsonb('attributes').$type<ClauseAttributesDto>(),
  flags: jsonb('flags').$type<string[]>(),
  reviewStatus: text('review_status').notNull().default('UNREVIEWED'),
  reviewedByName: text('reviewed_by_name'),
  fulfilmentStatus: text('fulfilment_status').notNull().default('NOT_STARTED'),
  fulfilmentOwnerId: text('fulfilment_owner_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;

export interface StoredConflictValue {
  display: string;
  clauseId: string;
  quote: string;
  page: number;
  clauseRef: string | null;
}

export const clauseConflicts = pgTable('clause_conflicts', {
  id: pk(),
  organizationId: orgId(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  documentId: text('document_id'),
  topic: text('topic').notNull(),
  attribute: text('attribute').notNull(),
  values: jsonb('conflict_values').notNull().$type<StoredConflictValue[]>(),
  aiPrecedenceNote: text('ai_precedence_note'),
  resolution: text('resolution').notNull().default('UNRESOLVED'),
  chosenClauseId: text('chosen_clause_id'),
  note: text('note'),
  resolvedBy: text('resolved_by'),
  resolvedByName: text('resolved_by_name'),
  resolvedAt: tstz('resolved_at'),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ClauseConflictRow = typeof clauseConflicts.$inferSelect;

export const extractionCoverage = pgTable('extraction_coverage', {
  documentId: text('document_id').primaryKey(),
  organizationId: orgId(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  pageCount: integer('page_count'),
  failedPages: jsonb('failed_pages').notNull().$type<{ page: number; reason: string }[]>(),
  status: text('status').notNull(),
  updatedAt: updatedAt(),
});

export type ExtractionCoverageRow = typeof extractionCoverage.$inferSelect;
