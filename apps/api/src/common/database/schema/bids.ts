import { pgTable, text, integer, bigint, real, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, tstzNow, createdAt, updatedAt } from './helpers.js';
import { organizations } from './tenants.js';
import { companies } from './companies.js';

export const bids = pgTable('bids', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Bid = typeof bids.$inferSelect;

export const tenderDocuments = pgTable('tender_documents', {
  id: pk(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  documentType: text('document_type').notNull(),
  status: text('status').notNull().default('UPLOADED'),
  processingAttempts: integer('processing_attempts').notNull().default(0),
  processingStartedAt: tstz('processing_started_at'),
  processingCompletedAt: tstz('processing_completed_at'),
  lastProcessingError: text('last_processing_error'),
  uploadedAt: tstzNow('uploaded_at'),
});

export type TenderDocument = typeof tenderDocuments.$inferSelect;

export const bidDecisions = pgTable('bid_decisions', {
  id: pk(),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  profileVersionId: text('profile_version_id').notNull(),
  verdict: text('verdict').notNull(),
  state: text('state').notNull(),
  readinessScore: real('readiness_score').notNull(),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
});

export type BidDecision = typeof bidDecisions.$inferSelect;

export const tenderDocumentChunks = pgTable('tender_document_chunks', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  bidId: text('bid_id')
    .notNull()
    .references(() => bids.id, { onDelete: 'cascade' }),
  documentId: text('document_id')
    .notNull()
    .references(() => tenderDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  chunkType: text('chunk_type').notNull().default('PROSE'),
  content: text('content').notNull(),
  pageNumber: integer('page_number').notNull(),
  sectionTitle: text('section_title'),
  clauseReference: text('clause_reference'),
  boundingBox: jsonb('bounding_box'),
  metadata: jsonb('metadata'),
  embedding: jsonb('embedding'),
  createdAt: createdAt(),
});

export type TenderDocumentChunk = typeof tenderDocumentChunks.$inferSelect;

