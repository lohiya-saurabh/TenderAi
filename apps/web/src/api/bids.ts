/**
 * TenderPulse AI — Bids API
 *
 * CRUD operations and upload workflow for tender bid projects.
 */

import { apiGet, apiPost, apiDelete, type ApiResult } from './client.js';

export type { ApiResult } from './client.js';

export interface BidSummary {
  id: string;
  companyId?: string;
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
  decision?: {
    decisionId: string;
    verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
    state: string;
    readinessScore: number;
    evaluatedAt: string;
  } | null;
}

export interface ListBidsQuery {
  companyId?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
  search?: string;
}

export interface PaginatedBidsResponse {
  items: BidSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  status:
    | 'PENDING_UPLOAD'
    | 'UPLOADED'
    | 'QUEUED_FOR_EXTRACTION'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'EXTRACTED'
    | 'FAILED'
    | 'DEAD_LETTER';
  uploadedAt: string;
}

export interface CreateBidRequest {
  companyId?: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees?: number;
  submissionDeadline?: string;
}

export interface CreateBidResponse {
  bidId: string;
  companyId?: string;
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

/** List all bids for current tenant with optional server-side pagination, sorting & filters */
export function listBids(): Promise<ApiResult<BidSummary[]>>;
export function listBids(query: ListBidsQuery): Promise<ApiResult<PaginatedBidsResponse>>;
export function listBids(
  query?: ListBidsQuery,
): Promise<ApiResult<BidSummary[] | PaginatedBidsResponse>> {
  if (!query) {
    return apiGet<BidSummary[]>('/api/v1/bids');
  }
  const params = new URLSearchParams();
  if (query.companyId) params.set('companyId', query.companyId);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  const qs = params.toString();
  return apiGet<PaginatedBidsResponse>(`/api/v1/bids${qs ? `?${qs}` : ''}`);
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

/** Queue a fresh extraction pass for an existing document. */
export function reprocessDocument(
  bidId: string,
  documentId: string,
): Promise<ApiResult<{ documentId: string; status: string; jobId: string }>> {
  return apiPost<{ documentId: string; status: string; jobId: string }>(
    `/api/v1/bids/${bidId}/documents/${documentId}/reprocess`,
    {},
  );
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
export type BidDecisionState = 'AI_PROPOSED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';

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
export function getBidDecision(bidId: string): Promise<ApiResult<BidDecisionSummary>> {
  return apiGet<BidDecisionSummary>(`/api/v1/bids/${bidId}/bid-decision`);
}

/**
 * Trigger a fresh deterministic evaluation against the
 * pinned Company Capability Profile.
 * Requires BIDS_UPDATE (writes a decision record).
 */
export function evaluateBidDecision(bidId: string): Promise<ApiResult<BidDecisionSummary>> {
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

// ---------------------------------------------------------------------------
// Tender Lifecycle Milestones & Countdown Deadlines
// ---------------------------------------------------------------------------

export interface TenderMilestone {
  milestoneKey: string;
  label: string;
  date: string | null;
  daysRemaining: number | null;
  status: 'UPCOMING' | 'IMMINENT' | 'OVERDUE' | 'NOT_SET';
  isMandatory: boolean;
  notes: string;
}

export interface TenderDeadlinesResponse {
  bidId: string;
  tenderNumber: string;
  submissionDeadline: string | null;
  daysRemaining: number | null;
  milestones: TenderMilestone[];
}

/** Get lifecycle milestone deadlines and countdown status for a bid */
export function getTenderDeadlines(bidId: string): Promise<ApiResult<TenderDeadlinesResponse>> {
  return apiGet<TenderDeadlinesResponse>(`/api/v1/bids/${bidId}/deadlines`);
}

// ---------------------------------------------------------------------------
// Pre-aggregated Dashboard KPIs
// ---------------------------------------------------------------------------

export interface DashboardMetricsResponse {
  activePipelineCount: number;
  totalPipelineValueRupees: number;
  totalFlaggedRequirements: number;
  imminentDeadlinesCount: number;
  pipelineDistribution: Record<string, number>;
  totalTendersCount: number;
  updatedAt: string;
}

/** Get pre-aggregated tenant KPIs and pipeline analytics */
export function getDashboardMetrics(): Promise<ApiResult<DashboardMetricsResponse>> {
  return apiGet<DashboardMetricsResponse>('/api/v1/dashboard/metrics');
}

// ---------------------------------------------------------------------------
// Evidence Matches & Grounding
// ---------------------------------------------------------------------------

export interface EvidenceMatchItem {
  complianceItemId: string;
  category: string;
  requirementTitle: string;
  description: string;
  status: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'EXPIRED';
  tenderCitation: {
    documentId?: string;
    documentName?: string;
    pageNumber?: number;
    sectionOrClause?: string;
    verbatimQuote?: string;
    confidenceScore?: number;
  };
  companyEvidence: {
    id?: string;
    title?: string;
    docType?: string;
    documentName?: string;
    status?: string;
    udinNumber?: string;
    expiryDate?: string | null;
    notes?: string;
  } | null;
  executionRules?: {
    stampPaperRequired?: boolean;
    stampPaperDenominationInr?: number | null;
    notarizationRequired?: boolean;
    udinRequired?: boolean;
    signingAuthorityRank?: string;
  };
}

export interface EvidenceMatchesResponse {
  bidId: string;
  totalRequirements: number;
  totalMatched: number;
  totalPartial: number;
  totalUnmatched: number;
  coveragePct: number;
  matches: EvidenceMatchItem[];
}

/** Get company-side proof cross-referencing and coverage rollup for a bid */
export function getEvidenceMatches(bidId: string): Promise<ApiResult<EvidenceMatchesResponse>> {
  return apiGet<EvidenceMatchesResponse>(`/api/v1/bids/${bidId}/evidence-matches`);
}

// ---------------------------------------------------------------------------
// Consolidated Statutory and Commercial Risk Radar
// ---------------------------------------------------------------------------

export interface StatutoryRiskItem {
  complianceItemId: string;
  category: string;
  title: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  financialImpactRupees: number;
  mitigationAdvice: string | null;
  clauseCitation: string | null;
  executionConstraints: string[];
}

export interface CommercialRiskItem {
  riskId?: string;
  category: string;
  title?: string;
  summary: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  mitigationAdvice?: string | null;
  source: 'BID_DECISION' | 'REQUIREMENT_MATRIX';
}

export interface RiskFindingsResponse {
  bidId: string;
  tenderNumber: string;
  summary: {
    totalRisks: number;
    criticalCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    statutoryComplianceRiskCount: number;
    commercialRiskCount: number;
    estimatedFinancialExposureRupees: number;
  };
  statutoryRisks: StatutoryRiskItem[];
  commercialRisks: CommercialRiskItem[];
  hardDisqualifiers: string[];
  uncertainAreas: string[];
  reviewTriggers: string[];
  evaluatedAt: string;
}

/** Get consolidated statutory, execution, and commercial risk radar for a bid */
export function getRiskFindings(bidId: string): Promise<ApiResult<RiskFindingsResponse>> {
  return apiGet<RiskFindingsResponse>(`/api/v1/bids/${bidId}/risk-findings`);
}

// ---------------------------------------------------------------------------
// Corrigendum & Tender Amendment Notification Stream
// ---------------------------------------------------------------------------

export interface TenderAmendmentItem {
  id: string;
  bidId: string;
  tenderNumber: string;
  tenderTitle: string;
  tenderingAuthority: string;
  corrigendumNumber: string;
  documentId: string;
  documentName: string;
  publishedAt: string;
  amendmentType:
    | 'DEADLINE_EXTENSION'
    | 'TECHNICAL_SPEC_CHANGE'
    | 'EMD_AMENDMENT'
    | 'ELIGIBILITY_REVISION'
    | 'GENERAL_CLARIFICATION';
  summary: string;
  impact: {
    deadlineChanged: boolean;
    previousDeadline: string | null;
    revisedDeadline: string | null;
    daysExtended: number | null;
    affectedRequirementsCount: number;
    requiresReEvaluation: boolean;
  };
  status: 'PROCESSED' | 'EVALUATED' | 'REQUIRES_CONFIRMATION';
}

export interface TenderAmendmentsResponse {
  organizationId: string;
  totalAmendments: number;
  unreadCount: number;
  amendments: TenderAmendmentItem[];
}

/** Get corrigendum / amendment notification and impact stream across monitored tenders */
export function getTenderAmendments(bidId?: string): Promise<ApiResult<TenderAmendmentsResponse>> {
  return apiGet<TenderAmendmentsResponse>(
    `/api/v1/tenders/amendments${bidId ? `?bidId=${bidId}` : ''}`,
  );
}
