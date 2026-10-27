/**
 * Clause workspace API (Phase 1 clause contract, see packages/shared-types clause.ts).
 */
import type {
  BidClauseSummary,
  BulkReviewRequest,
  ClauseDetail,
  ClauseListResponse,
  ClauseReviewRequest,
  Conflict,
  ConflictResolutionRequest,
  Coverage,
  DocumentPageText,
} from '@tenderpulse/shared-types';
import { apiGet, apiPatch, apiPost, type ApiResult } from './client.js';

const base = (bidId: string) => `/api/v1/bids/${encodeURIComponent(bidId)}`;

export const listClauses = (bidId: string): Promise<ApiResult<ClauseListResponse>> =>
  apiGet(`${base(bidId)}/clauses`);

export const getClause = (bidId: string, clauseId: string): Promise<ApiResult<ClauseDetail>> =>
  apiGet(`${base(bidId)}/clauses/${encodeURIComponent(clauseId)}`);

export const reviewClause = (
  bidId: string,
  clauseId: string,
  body: ClauseReviewRequest,
): Promise<ApiResult<ClauseDetail>> =>
  apiPost(`${base(bidId)}/clauses/${encodeURIComponent(clauseId)}/review`, body);

export const bulkReviewClauses = (
  bidId: string,
  body: BulkReviewRequest,
): Promise<ApiResult<{ confirmed: number; clauseIds: string[] }>> =>
  apiPost(`${base(bidId)}/clauses/bulk-review`, body);

export const listConflicts = (bidId: string): Promise<ApiResult<Conflict[]>> =>
  apiGet(`${base(bidId)}/conflicts`);

export const resolveConflict = (
  bidId: string,
  conflictId: string,
  body: ConflictResolutionRequest,
): Promise<ApiResult<Conflict>> =>
  apiPatch(`${base(bidId)}/conflicts/${encodeURIComponent(conflictId)}`, body);

export const getCoverage = (bidId: string): Promise<ApiResult<Coverage>> =>
  apiGet(`${base(bidId)}/coverage`);

export const getClauseSummary = (bidId: string): Promise<ApiResult<BidClauseSummary>> =>
  apiGet(`${base(bidId)}/summary`);

export const getPageText = (
  bidId: string,
  documentId: string,
  page: number,
): Promise<ApiResult<DocumentPageText>> =>
  apiGet(`${base(bidId)}/documents/${encodeURIComponent(documentId)}/pages/${page}`);
