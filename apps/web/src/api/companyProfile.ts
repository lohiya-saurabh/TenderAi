/**
 * TenderPulse AI — Company Capability Profile types
 *
 * Wire types for the pinned, versioned Company Capability Profile.
 * The profile is the factual basis for all bid/no-bid evaluations.
 * Requests go through the company-scoped client in `@/api/companies.js`
 * (`/api/v1/companies/:companyId/profile`).
 */

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
  solvency_records?: Array<{
    entry_id: string;
    bank_name: string;
    solvency_limit_inr_crores: number;
    sanction_date?: string | null;
    valid_until?: string | null;
    account_number_masked?: string | null;
    evidence_document_id?: string | null;
  }>;
  credit_rating?: {
    agency: string;
    rating: string;
    valid_until?: string | null;
  };
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
  companyId?: string;
  organizationId: string;
  version: number;
  name: string;
  payload: CompanyProfilePayload;
  createdBy: string;
  createdAt: string;
}

export interface CompanyProfileView {
  companyId?: string;
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
  companyId?: string;
  activeProfileVersionId: string | null;
  evaluatedAt: string;
  filterWithinDays: number;
  totalExpiringCount: number;
  totalExpiredCount: number;
  certificates: ExpiringCertificateItem[];
}
