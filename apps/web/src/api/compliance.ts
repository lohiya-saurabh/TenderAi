/**
 * TenderPulse AI — Compliance API
 *
 * Compliance item matrix and review lifecycle.
 */

import { apiGet, apiPatch, type ApiResult } from './client.js';

export interface ExecutionRules {
  stampPaperRequired: boolean;
  stampPaperDenominationInr?: number | null;
  notarizationRequired: boolean;
  udinRequired: boolean;
  signingAuthorityRank?: string | null;
}

export interface Provenance {
  documentId: string;
  documentName?: string;
  pageNumber: number;
  sectionOrClause?: string | null;
  verbatimQuote: string;
  confidenceScore: number;
}

export interface ComplianceItem {
  id: string;
  bidId: string;
  category: 'LEGAL' | 'TECHNICAL' | 'FINANCIAL' | 'STATUTORY' | 'EXECUTION';
  title: string;
  description: string;
  status: 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';
  humanReviewRequired: boolean;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  version: number;
  executionRules: ExecutionRules;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateComplianceItemRequest {
  status?: 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';
  notes?: string;
  expectedVersion?: number;
}

export interface UpdateComplianceItemResponse {
  id: string;
  status: 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';
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
