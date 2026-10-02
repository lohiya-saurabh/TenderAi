/**
 * TenderPulse AI — Bids API
 *
 * CRUD operations and upload workflow for tender bid projects.
 */

import { apiGet, apiPost, type ApiResult } from './client.js';

export interface BidSummary {
  id: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees?: number | null;
  submissionDeadline?: string | null;
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
