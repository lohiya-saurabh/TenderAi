/**
 * Evidence -> company profile. Only attributes the AI read from the document (each with its
 * quote, already verified at extraction) are copied; anything a profile entry needs that the
 * document did not state is reported as skipped, never filled in.
 */
import type { CompanyEvidenceDocument } from '@/common/database/schema.js';
import { parseFlexibleDate } from '@/modules/company-verification/application/company-evidence.utils.js';
import type { CompanyProfilePayload } from '../presentation/dto/CompanyProfilePayload.js';

export interface EvidenceMergeResult {
  payload: CompanyProfilePayload;
  added: string[];
  skipped: string[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isoDate = (v: unknown): string | null => {
  const d = parseFlexibleDate(str(v) ?? undefined);
  return d ? d.toISOString().slice(0, 10) : null;
};

export function mergeEvidenceIntoProfile(
  base: CompanyProfilePayload,
  evidence: Pick<
    CompanyEvidenceDocument,
    'id' | 'fileName' | 'issuer' | 'validFrom' | 'validTo' | 'extractedAttributes'
  >,
): EvidenceMergeResult {
  const attrs = (evidence.extractedAttributes ?? {}) as Record<string, unknown>;
  const payload: CompanyProfilePayload = structuredClone(base);
  const added: string[] = [];
  const skipped: string[] = [];

  // Turnover per financial year (CA certificates, balance sheets): replaces the same year.
  const byYear = attrs.turnover_by_fy as Record<string, unknown> | undefined;
  if (byYear && typeof byYear === 'object') {
    const records = (payload.turnover_records ?? []).slice();
    for (const [year, value] of Object.entries(byYear)) {
      const crores = num(value);
      if (crores === null) {
        skipped.push(`Turnover ${year}: amount not readable`);
        continue;
      }
      const at = records.findIndex((r) => r.financial_year === year);
      const entry = {
        entry_id: `ev-${evidence.id}-${year}`,
        financial_year: year,
        turnover_inr_crores: crores,
        ca_udin: str(attrs.udin),
        evidence_document_id: evidence.id,
      };
      if (at >= 0) records[at] = entry;
      else records.push(entry);
      added.push(`Turnover ${year}: ₹${crores} Cr`);
    }
    payload.turnover_records = records;
  }

  // Completed work (completion certificates, work orders).
  const project = str(attrs.project_name);
  if (project) {
    const value = num(attrs.completed_value_inr_cr) ?? num(attrs.contract_value_inr_cr);
    const client = str(attrs.client_name) ?? str(evidence.issuer);
    const completed = isoDate(attrs.completion_date);
    const missing = [
      !client && 'client',
      value === null && 'value',
      !completed && 'completion date',
    ].filter(Boolean);
    if (missing.length > 0) {
      skipped.push(`Project "${project}": ${missing.join(', ')} not stated`);
    } else {
      const experience = (payload.experience ?? []).filter(
        (e) => e.evidence_document_id !== evidence.id,
      );
      experience.push({
        entry_id: `ev-${evidence.id}-project`,
        project_name: project,
        client_name: client as string,
        contract_value_inr_crores: value as number,
        completion_date: completed as string,
        location_state: '',
        evidence_document_id: evidence.id,
      });
      payload.experience = experience;
      added.push(`Project "${project}" (₹${value} Cr, completed ${completed})`);
    }
  }

  // Certificates (ISO and other accreditations).
  const standard = str(attrs.standard);
  if (standard) {
    const issuer = str(attrs.issuer) ?? str(evidence.issuer);
    const from =
      isoDate(attrs.valid_from) ?? evidence.validFrom?.toISOString().slice(0, 10) ?? null;
    const to = isoDate(attrs.valid_to) ?? evidence.validTo?.toISOString().slice(0, 10) ?? null;
    if (!issuer || !from) {
      skipped.push(
        `Certificate "${standard}": ${!issuer ? 'issuer' : 'validity start'} not stated`,
      );
    } else {
      const certs = (payload.certifications ?? []).filter(
        (c) => c.evidence_document_id !== evidence.id,
      );
      certs.push({
        entry_id: `ev-${evidence.id}-cert`,
        standard_name: standard,
        issuing_body: issuer,
        valid_from: from,
        valid_to: to,
        evidence_document_id: evidence.id,
      });
      payload.certifications = certs;
      added.push(`Certificate "${standard}"${to ? ` valid to ${to}` : ''}`);
    }
  }

  return { payload, added, skipped };
}
