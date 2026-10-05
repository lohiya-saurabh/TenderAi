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
  createdAt: string;
  updatedAt: string;
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
