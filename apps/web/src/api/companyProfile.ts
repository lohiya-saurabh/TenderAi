/**
 * TenderPulse AI — Company Capability Profile API
 *
 * CRUD for the pinned, versioned Company Capability Profile.
 * The profile is the factual basis for all bid/no-bid evaluations.
 */

import { apiGet, apiPost, type ApiResult } from '@/api/client.js';

export interface CompanyProfilePayload {
  company_name: string;
  is_blacklisted?: boolean;
  registrations?: Record<string, string>;
  operating_regions?: string[];
  turnover_records?: Array<{
    entry_id: string;
    financial_year: string;
    turnover_inr_crores: number;
    ca_udin?: string | null;
    evidence_document_id: string;
  }>;
  experience?: Array<{
    entry_id: string;
    project_name: string;
    client_name: string;
    contract_value_inr_crores: number;
    completion_date: string;
    work_type_tags?: string[];
    location_state: string;
    evidence_document_id: string;
  }>;
  certifications?: Array<{
    entry_id: string;
    standard_name: string;
    issuing_body: string;
    valid_from: string;
    valid_to?: string | null;
    evidence_document_id: string;
  }>;
  oem_authorizations?: Array<{
    entry_id: string;
    oem_name: string;
    product_lines?: string[];
    valid_from: string;
    valid_to: string;
    evidence_document_id: string;
  }>;
  staff?: Array<{
    entry_id: string;
    name: string;
    role: string;
    qualification: string;
    experience_years: number;
    evidence_document_id: string;
  }>;
  equipment?: Array<{
    entry_id: string;
    name: string;
    equipment_type: string;
    quantity: number;
    owned?: boolean;
    evidence_document_id: string;
  }>;
}

export interface CompanyProfileVersion {
  id: string;
  organizationId: string;
  version: number;
  name: string;
  payload: CompanyProfilePayload;
  createdBy: string;
  createdAt: string;
}

export interface CompanyProfileView {
  active: CompanyProfileVersion | null;
  versions: CompanyProfileVersion[];
}

export interface ExpiringCertificateItem {
  entryId: string;
  type: 'CERTIFICATION' | 'OEM_AUTHORIZATION';
  name: string;
  issuingAuthority: string;
  validFrom: string;
  validTo: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  isUrgent: boolean;
  evidenceDocumentId: string;
}

export interface ExpiringCertificatesResponse {
  organizationId: string;
  activeProfileVersionId: string | null;
  evaluatedAt: string;
  filterWithinDays: number;
  totalExpiringCount: number;
  totalExpiredCount: number;
  certificates: ExpiringCertificateItem[];
}

/** Active profile + version history */
export function getCompanyProfile(): Promise<ApiResult<CompanyProfileView>> {
  return apiGet<CompanyProfileView>('/api/v1/company-profile');
}

/** Fetch expiring certificates and licenses within the specified days window */
export function getExpiringCertificates(
  withinDays = 90,
): Promise<ApiResult<ExpiringCertificatesResponse>> {
  return apiGet<ExpiringCertificatesResponse>(
    `/api/v1/company-profile/expiring-certificates?withinDays=${withinDays}`,
  );
}

/** Pin a new immutable profile version and make it active (ADMIN only) */
export function createCompanyProfileVersion(
  name: string,
  payload: CompanyProfilePayload,
): Promise<ApiResult<CompanyProfileVersion>> {
  return apiPost<CompanyProfileVersion>('/api/v1/company-profile', { name, payload });
}

/** Fetch a specific pinned version by id */
export function getCompanyProfileVersion(
  versionId: string,
): Promise<ApiResult<CompanyProfileVersion>> {
  return apiGet<CompanyProfileVersion>(`/api/v1/company-profile/versions/${versionId}`);
}
