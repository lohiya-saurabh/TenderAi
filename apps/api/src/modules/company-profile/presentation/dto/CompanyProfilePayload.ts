/**
 * Company Capability Profile payload — canonical wire/storage shape.
 *
 * Mirrors the AI engine's CompanyProfileSnapshot contract
 * (apps/ai/src/tenderpulse_ai/decision/schemas.py) field-for-field
 * so a pinned version can be passed to the bid-decision evaluation
 * without mapping drift. Stored as an immutable JSONB snapshot.
 */

export interface CompanyTurnoverRecord {
  entry_id: string;
  financial_year: string;
  turnover_inr_crores: number;
  ca_udin?: string | null;
  evidence_document_id: string;
}

export interface CompanyExperienceEntry {
  entry_id: string;
  project_name: string;
  client_name: string;
  contract_value_inr_crores: number;
  completion_date: string; // ISO date (YYYY-MM-DD)
  work_type_tags?: string[];
  location_state: string;
  evidence_document_id: string;
}

export interface CompanyCertificationEntry {
  entry_id: string;
  standard_name: string;
  issuing_body: string;
  valid_from: string; // ISO date
  valid_to?: string | null; // null = open-ended
  evidence_document_id: string;
}

export interface CompanyOemAuthEntry {
  entry_id: string;
  oem_name: string;
  product_lines?: string[];
  valid_from: string;
  valid_to: string;
  evidence_document_id: string;
}

export interface CompanyStaffEntry {
  entry_id: string;
  name: string;
  role: string;
  qualification: string;
  experience_years: number;
  evidence_document_id: string;
}

export interface CompanyEquipmentEntry {
  entry_id: string;
  name: string;
  equipment_type: string;
  quantity: number;
  owned?: boolean;
  evidence_document_id: string;
}

export interface CompanyProfilePayload {
  company_name: string;
  is_blacklisted?: boolean;
  registrations?: Record<string, string>;
  operating_regions?: string[];
  turnover_records?: CompanyTurnoverRecord[];
  experience?: CompanyExperienceEntry[];
  certifications?: CompanyCertificationEntry[];
  oem_authorizations?: CompanyOemAuthEntry[];
  staff?: CompanyStaffEntry[];
  equipment?: CompanyEquipmentEntry[];
}

/**
 * Validates a profile payload at write time so malformed snapshots
 * are rejected at the API boundary — not deep inside the AI
 * evaluation pipeline. Returns a list of human-readable violations.
 */
export function validateCompanyProfilePayload(
  payload: unknown,
): string[] {
  const violations: string[] = [];
  if (payload === null || typeof payload !== 'object') {
    return ['Payload must be a JSON object.'];
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.company_name !== 'string' || p.company_name.trim().length === 0) {
    violations.push('company_name is required.');
  }
  if (p.is_blacklisted !== undefined && typeof p.is_blacklisted !== 'boolean') {
    violations.push('is_blacklisted must be a boolean.');
  }
  if (
    p.registrations !== undefined &&
    (typeof p.registrations !== 'object' || Array.isArray(p.registrations))
  ) {
    violations.push('registrations must be an object map.');
  }
  if (
    p.operating_regions !== undefined &&
    !Array.isArray(p.operating_regions)
  ) {
    violations.push('operating_regions must be an array of strings.');
  }

  const entryArrays: Array<[string, Array<keyof never>]> = [
    ['turnover_records', []],
    ['experience', []],
    ['certifications', []],
    ['oem_authorizations', []],
    ['staff', []],
    ['equipment', []],
  ];

  for (const [field] of entryArrays) {
    const list = p[field];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      violations.push(`${field} must be an array.`);
      continue;
    }
    list.forEach((entry, index) => {
      if (entry === null || typeof entry !== 'object') {
        violations.push(`${field}[${index}] must be an object.`);
        return;
      }
      const e = entry as Record<string, unknown>;
      if (typeof e.entry_id !== 'string' || e.entry_id.length === 0) {
        violations.push(`${field}[${index}].entry_id is required.`);
      }
      if (field === 'turnover_records') {
        if (typeof e.financial_year !== 'string' || e.financial_year.length < 4) {
          violations.push(`${field}[${index}].financial_year is required (e.g. "FY24").`);
        }
        if (typeof e.turnover_inr_crores !== 'number' || e.turnover_inr_crores < 0) {
          violations.push(`${field}[${index}].turnover_inr_crores must be a non-negative number.`);
        }
      }
      if (typeof e.evidence_document_id !== 'string' || e.evidence_document_id.length === 0) {
        violations.push(`${field}[${index}].evidence_document_id is required.`);
      }
    });
  }

  return violations;
}
