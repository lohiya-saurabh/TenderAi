import { pgTable, text, integer, bigint, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, tstzNow, createdAt, updatedAt } from './helpers.js';

export const EvidenceVerificationStatus = {
  IMPORTED: 'IMPORTED',
  EXTRACTED: 'EXTRACTED',
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
} as const;

export type EvidenceVerificationStatus =
  (typeof EvidenceVerificationStatus)[keyof typeof EvidenceVerificationStatus];

export const EvidenceSourceProvider = {
  LOCAL_UPLOAD: 'LOCAL_UPLOAD',
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  ONEDRIVE: 'ONEDRIVE',
  DIGILOCKER: 'DIGILOCKER',
} as const;

export type EvidenceSourceProvider =
  (typeof EvidenceSourceProvider)[keyof typeof EvidenceSourceProvider];

export const companies = pgTable('companies', {
  id: pk(),
  organizationId: orgId(),
  legalName: text('legal_name').notNull(),
  slug: text('slug'),
  gstin: text('gstin'),
  pan: text('pan'),
  udyamId: text('udyam_id'),
  constitution: text('constitution'),
  cin: text('cin'),
  gstinVerifiedAt: tstz('gstin_verified_at'),
  gstinVerificationData: jsonb('gstin_verification_data'),
  udyamVerifiedAt: tstz('udyam_verified_at'),
  udyamVerificationData: jsonb('udyam_verification_data'),
  mcaVerifiedAt: tstz('mca_verified_at'),
  mcaVerificationData: jsonb('mca_verification_data'),
  digilockerLinkedAt: tstz('digilocker_linked_at'),
  digilockerMetadata: jsonb('digilocker_metadata'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Company = typeof companies.$inferSelect;

export const companyProfileVersions = pgTable('company_profile_versions', {
  id: pk(),
  companyId: text('company_id').notNull(),
  organizationId: orgId(),
  version: integer('version').notNull(),
  name: text('name').notNull(),
  payload: jsonb('payload').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: createdAt(),
});

export type CompanyProfileVersion = typeof companyProfileVersions.$inferSelect;

export const companyProfiles = pgTable('company_profiles', {
  id: pk(),
  companyId: text('company_id').notNull(),
  organizationId: orgId(),
  activeVersionId: text('active_version_id').notNull(),
  updatedAt: updatedAt(),
});

export type CompanyProfile = typeof companyProfiles.$inferSelect;

export const companyEvidenceDocuments = pgTable('company_evidence_documents', {
  id: pk(),
  organizationId: orgId(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  sha256Hash: text('sha256_hash').notNull(),
  evidenceType: text('evidence_type').notNull(),
  issuer: text('issuer'),
  referenceNumber: text('reference_number'),
  validFrom: tstz('valid_from'),
  validTo: tstz('valid_to'),
  sourceProvider: text('source_provider')
    .notNull()
    .default('LOCAL_UPLOAD')
    .$type<EvidenceSourceProvider>(),
  sourceReference: text('source_reference'),
  importedAt: tstzNow('imported_at'),
  verificationStatus: text('verification_status')
    .notNull()
    .default('IMPORTED')
    .$type<EvidenceVerificationStatus>(),
  verificationMethod: text('verification_method'),
  verifiedAt: tstz('verified_at'),
  verifiedBy: text('verified_by'),
  discrepancyNotes: text('discrepancy_notes'),
  extractedAttributes: jsonb('extracted_attributes'),
  metadata: jsonb('metadata'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type CompanyEvidenceDocument = typeof companyEvidenceDocuments.$inferSelect;

export const evidenceVerificationHistory = pgTable('evidence_verification_history', {
  id: pk(),
  organizationId: orgId(),
  companyId: text('company_id').notNull(),
  evidenceDocumentId: text('evidence_document_id')
    .notNull()
    .references(() => companyEvidenceDocuments.id, { onDelete: 'cascade' }),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  verificationMethod: text('verification_method').notNull(),
  verifiedBy: text('verified_by').notNull(),
  verificationPayload: jsonb('verification_payload'),
  discrepancyNotes: text('discrepancy_notes'),
  timestamp: tstzNow('timestamp'),
});

export type EvidenceVerificationHistoryRecord = typeof evidenceVerificationHistory.$inferSelect;

export const companyEvidenceChunks = pgTable('company_evidence_chunks', {
  id: pk(),
  organizationId: orgId(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  evidenceDocumentId: text('evidence_document_id')
    .notNull()
    .references(() => companyEvidenceDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  chunkType: text('chunk_type').notNull().default('PROSE'),
  content: text('content').notNull(),
  pageNumber: integer('page_number').notNull(),
  clauseReference: text('clause_reference'),
  boundingBox: jsonb('bounding_box'),
  metadata: jsonb('metadata'),
  embedding: jsonb('embedding'),
  createdAt: createdAt(),
});

export type CompanyEvidenceChunk = typeof companyEvidenceChunks.$inferSelect;
