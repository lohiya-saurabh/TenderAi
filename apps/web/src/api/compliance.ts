/**
 * TenderPulse AI — Compliance API
 *
 * Compliance item matrix and review lifecycle.
 * Updated to support the enhanced Requirement/Compliance Matrix.
 */

import { apiGet, apiPatch, type ApiResult } from './client.js';

/** Execution/statutory rules specific to Indian tender compliance */
export interface ExecutionRules {
  stampPaperRequired: boolean;
  stampPaperDenominationInr?: number | null;
  notarizationRequired: boolean;
  udinRequired: boolean;
  signingAuthorityRank?: string | null;
}

/** Source citation grounding for a requirement */
export interface Provenance {
  documentId: string;
  documentName?: string;
  pageNumber: number;
  sectionOrClause?: string | null;
  verbatimQuote: string;
  confidenceScore: number;
}

/** Company evidence linked to a requirement */
export interface CompanyEvidence {
  id: string;
  title: string;
  docType: string;
  documentName?: string;
  status: 'VERIFIED' | 'SELF_ATTESTED' | 'EXPIRED' | 'MISSING' | 'PENDING_UPLOAD';
  udinNumber?: string;
  expiryDate?: string | null;
  notes?: string;
}

/** Risk assessment for a requirement */
export interface RequirementRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category:
    | 'LIQUIDATED_DAMAGES'
    | 'WORKING_CAPITAL'
    | 'TIMELINE'
    | 'PAYMENT_TERMS'
    | 'LEGAL'
    | 'STATUTORY'
    | 'TECHNICAL'
    | 'FINANCIAL';
  summary: string;
  financialImpactRupees?: number;
  mitigation?: string;
}

/** Assessment rationale explaining why the system reached this result */
export interface AssessmentRationale {
  ruleApplied: string;
  tenderRequirement: string;
  companyCapability: string;
  comparisonResult: 'MET' | 'NOT_MET' | 'PARTIAL' | 'UNCLEAR';
  confidenceScore: number;
  details: string[];
}

/** Source citation for UI display */
export interface SourceCitation {
  document: string;
  page: number;
  section: string;
  verbatimQuote: string;
  confidenceScore: number;
}

/** Enhanced compliance item for the Requirement/Compliance Matrix */
export interface ComplianceItem {
  id: string;
  bidId: string;

  // Core requirement info
  requirement: string;
  description: string;
  category: 'LEGAL' | 'TECHNICAL' | 'FINANCIAL' | 'STATUTORY' | 'EXECUTION' | 'COMMERCIAL';
  subCategory?: string;
  isMandatory: boolean;
  tenderClauseRef?: string;

  // Status using the new required statuses
  status: 'PASS' | 'FAIL' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';

  // Evidence & assessment
  companyEvidence: CompanyEvidence | null;
  risk: RequirementRisk | null;
  rationale: AssessmentRationale | null;
  provenance: Provenance;
  sourceCitation: SourceCitation;

  // Review workflow
  humanReviewRequired: boolean;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  version: number;
  executionRules: ExecutionRules;
  createdAt: string;
  updatedAt: string;
}

/** Request to update a compliance item review */
export interface UpdateComplianceItemRequest {
  status?: 'PASS' | 'FAIL' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  notes?: string;
  expectedVersion?: number;
  evidenceId?: string;
}

/** Response after updating a compliance item */
export interface UpdateComplianceItemResponse {
  id: string;
  status: 'PASS' | 'FAIL' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  reviewNotes?: string;
  reviewedBy: string;
  reviewedAt: string;
  version: number;
}

/** List all compliance items for a bid */
export function listComplianceItems(bidId: string): Promise<ApiResult<ComplianceItem[]>> {
  return apiGet<ComplianceItem[]>(`/api/v1/bids/${bidId}/compliance-items`);
}

/** Get a single compliance item by ID */
export function getComplianceItem(
  bidId: string,
  itemId: string,
): Promise<ApiResult<ComplianceItem>> {
  return apiGet<ComplianceItem>(`/api/v1/bids/${bidId}/compliance-items/${itemId}`);
}

/** Review (Approve/Flag/Waive/Edit) a compliance item with optimistic concurrency check */
export function reviewComplianceItem(
  bidId: string,
  itemId: string,
  payload: UpdateComplianceItemRequest,
): Promise<ApiResult<UpdateComplianceItemResponse>> {
  return apiPatch<UpdateComplianceItemResponse>(
    `/api/v1/bids/${bidId}/compliance-items/${itemId}`,
    payload,
  );
}

/** Bulk update compliance items */
export function bulkReviewComplianceItems(
  bidId: string,
  items: Array<{
    id: string;
    status: ComplianceItem['status'];
    notes?: string;
    expectedVersion: number;
  }>,
): Promise<ApiResult<UpdateComplianceItemResponse[]>> {
  return apiPatch<UpdateComplianceItemResponse[]>(`/api/v1/bids/${bidId}/compliance-items/bulk`, {
    items,
  });
}
