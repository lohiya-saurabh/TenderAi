/**
 * TenderPulse AI — Bids API
 *
 * CRUD operations and upload workflow for tender bid projects.
 */

import { apiGet, apiPost, apiDelete, type ApiResult } from './client.js';

export type { ApiResult } from './client.js';

export interface BidSummary {
  id: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees?: number | null;
  submissionDeadline?: string | null;
  locationState?: string | null;
  status: 'DRAFT' | 'ANALYZING' | 'REVIEW_READY' | 'SUBMITTED' | 'ARCHIVED';
  totalRequirements?: number;
  flaggedRequirements?: number;
  approvedRequirements?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BidDetail extends BidSummary {
  documents: BidDocument[];
}

export interface BidDocument {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  documentType: 'NIT' | 'BOQ' | 'CORRIGENDUM' | 'TECHNICAL_SPECS' | 'FINANCIAL_BID';
  status: 'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'FAILED';
  uploadedAt: string;
}

export interface CreateBidRequest {
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees?: number;
  submissionDeadline?: string;
}

export interface CreateBidResponse {
  bidId: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  status: string;
  createdAt: string;
}

export interface GenerateUploadUrlRequest {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  documentType: 'NIT' | 'BOQ' | 'CORRIGENDUM' | 'TECHNICAL_SPECS' | 'FINANCIAL_BID';
  checksumSha256?: string;
}

export interface GenerateUploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}

export interface ConfirmUploadRequest {
  documentId: string;
}

export interface ConfirmUploadResponse {
  documentId: string;
  status: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresInSeconds: number;
}

/** List all bids for current tenant */
export function listBids(): Promise<ApiResult<BidSummary[]>> {
  return apiGet<BidSummary[]>('/api/v1/bids');
}

/** Get a single bid by ID with document list */
export function getBid(bidId: string): Promise<ApiResult<BidDetail>> {
  return apiGet<BidDetail>(`/api/v1/bids/${bidId}`);
}

/** Create a new bid project */
export function createBid(payload: CreateBidRequest): Promise<ApiResult<CreateBidResponse>> {
  return apiPost<CreateBidResponse>('/api/v1/bids', payload);
}

/** Request presigned S3 upload URL for a tender document */
export function generateUploadUrl(
  bidId: string,
  payload: GenerateUploadUrlRequest,
): Promise<ApiResult<GenerateUploadUrlResponse>> {
  return apiPost<GenerateUploadUrlResponse>(`/api/v1/bids/${bidId}/upload-url`, payload);
}

/** Confirm document upload to kick off extraction pipeline */
export function confirmDocumentUpload(
  bidId: string,
  payload: ConfirmUploadRequest,
): Promise<ApiResult<ConfirmUploadResponse>> {
  return apiPost<ConfirmUploadResponse>(`/api/v1/bids/${bidId}/documents/confirm`, payload);
}

/** Get presigned download URL for a document */
export function getDocumentDownloadUrl(
  bidId: string,
  documentId: string,
): Promise<ApiResult<DownloadUrlResponse>> {
  return apiGet<DownloadUrlResponse>(`/api/v1/bids/${bidId}/documents/${documentId}/download-url`);
}

// ---------------------------------------------------------------------------
// Bid decision — "Should we bid on this tender?"
// ---------------------------------------------------------------------------

/** Deterministic bid/no-bid verdict computed by the eligibility engine. */
export type BidVerdict = 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';

/**
 * Human-in-the-loop state of a decision. The engine proposes
 * (AI_PROPOSED); a human confirms or overrides. The UI must never
 * present an AI_PROPOSED verdict as final.
 */
export type BidDecisionState =
  | 'AI_PROPOSED'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'OVERRIDDEN';

/**
 * Wire contract of GET /api/v1/bids/:id/bid-decision
 * (BidsController.toDecisionWire).
 *
 * The verdict is computed deterministically against the pinned
 * Company Capability Profile — the AI engine cannot alter it.
 * `readinessScore` is 0.0–1.0. A bid with no evaluated decision
 * returns 404 (Not Found), which is the expected "not evaluated"
 * state, not an error.
 */
export interface BidDecisionSummary {
  decisionId: string;
  bidId: string;
  profileVersionId: string;
  verdict: BidVerdict;
  state: BidDecisionState;
  readinessScore: number;
  evaluatedAt: string;
  reasonsToPursue: unknown[];
  reasonsNotToPursue: unknown[];
  hardDisqualifiers: unknown[];
  missingInformation: unknown[];
  uncertainAreas: unknown[];
  commercialRisks: unknown[];
  evidenceCitations: unknown[];
  reviewTriggers: unknown[];
}

/**
 * Latest persisted bid/no-bid decision for a tender.
 * Requires BIDS_READ. 404 when the tender has never been evaluated.
 */
export function getBidDecision(
  bidId: string,
): Promise<ApiResult<BidDecisionSummary>> {
  return apiGet<BidDecisionSummary>(`/api/v1/bids/${bidId}/bid-decision`);
}

/**
 * Trigger a fresh deterministic evaluation against the
 * pinned Company Capability Profile.
 * Requires BIDS_UPDATE (writes a decision record).
 */
export function evaluateBidDecision(
  bidId: string,
): Promise<ApiResult<BidDecisionSummary>> {
  return apiPost<BidDecisionSummary>(`/api/v1/bids/${bidId}/bid-decision`, {});
}

export interface DeleteBidResponse {
  success: boolean;
  deletedBidId: string;
  deletedDocumentsCount: number;
}

/** Delete a bid project and permanently remove all uploaded documents */
export function deleteBid(bidId: string): Promise<ApiResult<DeleteBidResponse>> {
  return apiDelete<DeleteBidResponse>(`/api/v1/bids/${bidId}`);
}

export interface DeleteDocumentResponse {
  success: boolean;
  deletedDocumentId: string;
  removedCompliancesCount: number;
}

/** Delete a specific uploaded document and remove associated compliance requirements */
export function deleteDocument(
  bidId: string,
  documentId: string,
): Promise<ApiResult<DeleteDocumentResponse>> {
  return apiDelete<DeleteDocumentResponse>(`/api/v1/bids/${bidId}/documents/${documentId}`);
}



