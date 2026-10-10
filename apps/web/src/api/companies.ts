/**
 * TenderPulse AI — Multi-Company API Client
 *
 * Provides operations to list, create, and inspect business entities
 * (companies) scoped within the authenticated tenant boundary.
 */

import { apiGet, apiPost, type ApiResult } from './client.js';
import type {
  CompanyProfilePayload,
  CompanyProfileVersion,
  CompanyProfileView,
  ExpiringCertificatesResponse,
} from './companyProfile.js';

export interface CompanyItem {
  id: string;
  organizationId: string;
  legalName: string;
  slug?: string | null;
  gstin?: string | null;
  pan?: string | null;
  udyamId?: string | null;
  constitution?: string | null;
  cin?: string | null;
  gstinVerifiedAt?: string | null;
  gstinVerificationData?: Record<string, unknown> | null;
  udyamVerifiedAt?: string | null;
  udyamVerificationData?: Record<string, unknown> | null;
  mcaVerifiedAt?: string | null;
  mcaVerificationData?: Record<string, unknown> | null;
  digilockerLinkedAt?: string | null;
  digilockerMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceVerificationStatus =
  | 'IMPORTED'
  | 'EXTRACTED'
  | 'SOURCE_VERIFIED'
  | 'NEEDS_REVIEW'
  | 'EXPIRED'
  | 'REJECTED';

export interface EvidenceDocumentItem {
  id: string;
  organizationId: string;
  companyId: string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  evidenceType: string;
  issuer?: string | null;
  referenceNumber?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  sourceProvider: 'LOCAL_UPLOAD' | 'GOOGLE_DRIVE' | 'ONEDRIVE' | 'DIGILOCKER';
  sourceReference?: string | null;
  importedAt: string;
  verificationStatus: EvidenceVerificationStatus;
  verificationMethod?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  discrepancyNotes?: string | null;
  extractedAttributes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationResult {
  companyId: string;
  provider: 'IRIS_IRP_GSTIN' | 'MCA_REGISTRY' | 'MSME_UDYAM' | 'DIGILOCKER';
  verificationStatus: EvidenceVerificationStatus;
  discrepancies: string[];
  data: Record<string, unknown>;
  verifiedAt: string;
}

export interface VerificationHistoryItem {
  id: string;
  organizationId: string;
  companyId: string;
  evidenceDocumentId: string;
  previousStatus: string;
  newStatus: string;
  verificationMethod: string;
  verifiedBy: string;
  verificationPayload?: Record<string, unknown> | null;
  discrepancyNotes?: string | null;
  timestamp: string;
}

export interface CreateCompanyInput {
  legalName: string;
  slug?: string;
  gstin?: string;
  pan?: string;
  udyamId?: string;
  constitution?: string;
}

/**
 * List all companies belonging to the active tenant workspace.
 */
export function listCompanies(): Promise<ApiResult<CompanyItem[]>> {
  return apiGet<CompanyItem[]>('/api/v1/companies');
}

/**
 * Register a new company entity within the tenant workspace.
 */
export function createCompany(input: CreateCompanyInput): Promise<ApiResult<CompanyItem>> {
  return apiPost<CompanyItem>('/api/v1/companies', input);
}

/**
 * Get details for a specific company (anti-IDOR guarded by backend).
 */
export function getCompany(id: string): Promise<ApiResult<CompanyItem>> {
  return apiGet<CompanyItem>(`/api/v1/companies/${encodeURIComponent(id)}`);
}

/**
 * Fetch capability profile and version history for a specific company.
 */
export function getCompanyProfile(companyId?: string): Promise<ApiResult<CompanyProfileView>> {
  const url = companyId
    ? `/api/v1/companies/${encodeURIComponent(companyId)}/profile`
    : '/api/v1/company-profile';
  return apiGet<CompanyProfileView>(url);
}

/**
 * Pin a new capability profile version for a specific company.
 */
export function createCompanyProfile(
  companyId: string,
  input: { name: string; payload: CompanyProfilePayload },
): Promise<ApiResult<CompanyProfileVersion>> {
  return apiPost<CompanyProfileVersion>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/profile`,
    input,
  );
}

export const createCompanyProfileVersion = createCompanyProfile;

/**
 * Get expiring certificates for a specific company.
 */
export function getCompanyExpiringCertificates(
  companyId: string,
  withinDays = 90,
): Promise<ApiResult<ExpiringCertificatesResponse>> {
  return apiGet<ExpiringCertificatesResponse>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/expiring-certificates?withinDays=${withinDays}`,
  );
}

// ---------------------------------------------------------------------------
// Third-Party Verification & Identity Checks
// ---------------------------------------------------------------------------

export function verifyGstin(
  companyId: string,
  gstin: string,
): Promise<ApiResult<VerificationResult>> {
  return apiPost<VerificationResult>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/gstin`,
    { gstin },
  );
}

export function verifyMca(
  companyId: string,
  cin: string,
): Promise<ApiResult<VerificationResult>> {
  return apiPost<VerificationResult>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/mca`,
    { cin },
  );
}

export function verifyUdyam(
  companyId: string,
  udyamNumber: string,
): Promise<ApiResult<VerificationResult>> {
  return apiPost<VerificationResult>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/udyam`,
    { udyamNumber },
  );
}

export function getDigiLockerAuthUrl(
  companyId: string,
  redirectUri?: string,
): Promise<ApiResult<{ authorizationUrl: string; state: string }>> {
  const query = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : '';
  return apiGet<{ authorizationUrl: string; state: string }>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/digilocker/authorize${query}`,
  );
}

export function submitDigiLockerCallback(
  companyId: string,
  code: string,
  state: string,
  redirectUri?: string,
): Promise<ApiResult<EvidenceDocumentItem[]>> {
  return apiPost<EvidenceDocumentItem[]>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/digilocker/callback`,
    { code, state, redirectUri },
  );
}

export function getVerificationHistory(
  companyId: string,
): Promise<ApiResult<VerificationHistoryItem[]>> {
  return apiGet<VerificationHistoryItem[]>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/history`,
  );
}

export function reviewEvidenceDiscrepancy(
  companyId: string,
  input: {
    evidenceDocumentId: string;
    decision: 'ACCEPT_REGISTRY' | 'OVERRIDE_MANUAL' | 'REJECT';
    notes?: string;
  },
): Promise<ApiResult<EvidenceDocumentItem>> {
  return apiPost<EvidenceDocumentItem>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/verification/review-discrepancy`,
    input,
  );
}

// ---------------------------------------------------------------------------
// Evidence Documents Vault & Cloud Ingestion
// ---------------------------------------------------------------------------

export function listCompanyEvidence(
  companyId: string,
): Promise<ApiResult<EvidenceDocumentItem[]>> {
  return apiGet<EvidenceDocumentItem[]>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/evidence`,
  );
}

export function uploadCompanyEvidence(
  companyId: string,
  input: {
    fileName: string;
    fileBase64: string;
    mimeType?: string;
    evidenceType: string;
    issuer?: string;
    referenceNumber?: string;
    validFrom?: string;
    validTo?: string;
  },
): Promise<ApiResult<EvidenceDocumentItem>> {
  return apiPost<EvidenceDocumentItem>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/evidence/upload`,
    input,
  );
}

export function importCloudEvidence(
  companyId: string,
  input: {
    provider: 'google-drive' | 'onedrive';
    fileId: string;
    fileName?: string;
    evidenceType: string;
    issuer?: string;
    referenceNumber?: string;
    validFrom?: string;
    validTo?: string;
  },
): Promise<ApiResult<EvidenceDocumentItem>> {
  return apiPost<EvidenceDocumentItem>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/evidence/import-cloud`,
    input,
  );
}

export function listCloudFiles(
  companyId: string,
  provider: 'google-drive' | 'onedrive',
  folderId?: string,
): Promise<ApiResult<Array<{ id: string; name: string; mimeType: string; sizeBytes: number }>>> {
  const query = folderId ? `&folderId=${encodeURIComponent(folderId)}` : '';
  return apiGet<Array<{ id: string; name: string; mimeType: string; sizeBytes: number }>>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/evidence/cloud-files?provider=${provider}${query}`,
  );
}

