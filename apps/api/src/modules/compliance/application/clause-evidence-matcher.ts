/**
 * Links a tender clause to the company evidence that proves it, deterministically. The clause's
 * own words decide which kind of proof it needs; the company's active profile and evidence
 * documents decide whether that proof exists, is unverified, or expired. Nothing is inferred
 * beyond that: a clause that needs no document is "not applicable", not "unmatched".
 */
import type * as schema from '@/common/database/schema.js';
import type { CompanyProfilePayload } from '@/modules/company-profile/presentation/dto/CompanyProfilePayload.js';
import type { DemoCompanyEvidence } from '@/seed/data.js';

export type EvidenceNeed = 'TURNOVER' | 'SIMILAR_WORK' | 'CERTIFICATE' | 'REGISTRATION';

export interface MatchContext {
  profile: CompanyProfilePayload | null;
  evidenceById: Map<string, schema.CompanyEvidenceDocument>;
  company: schema.Company | null;
  /** The bid's submission deadline: certificates must be valid on it. */
  deadline: Date | null;
}

/** Which kind of proof the clause's own text asks for; null = none. */
export function evidenceNeed(text: string): EvidenceNeed | null {
  const t = text.toLowerCase();
  if (/\bturnover\b/.test(t)) return 'TURNOVER';
  if (
    /similar (nature of )?works?|work experience|completed (at least|similar|works?)|past (experience|performance)/.test(
      t,
    )
  )
    return 'SIMILAR_WORK';
  if (/\biso\s*\d{3,5}\b|certificat(e|ion) of (registration|accreditation)|accredit/.test(t))
    return 'CERTIFICATE';
  if (/\bgst(in)?\b|\bpan\b|\budyam\b|\bmsme\b|\bnsic\b/.test(t)) return 'REGISTRATION';
  return null;
}

function statusOf(doc: schema.CompanyEvidenceDocument | undefined): DemoCompanyEvidence['status'] {
  if (!doc) return 'MISSING';
  if (doc.verificationStatus === 'EXPIRED') return 'EXPIRED';
  if (doc.verificationStatus === 'SOURCE_VERIFIED') return 'VERIFIED';
  if (doc.verificationStatus === 'REJECTED') return 'MISSING';
  // Read from the document by AI but not checked against an external source yet.
  return 'SELF_ATTESTED';
}

function link(
  title: string,
  doc: schema.CompanyEvidenceDocument | undefined,
  status?: DemoCompanyEvidence['status'],
  expiryDate?: string | null,
): DemoCompanyEvidence {
  return {
    id: doc?.id ?? '',
    title,
    docType: doc?.evidenceType ?? '',
    documentName: doc?.fileName ?? '',
    status: status ?? statusOf(doc),
    expiryDate: expiryDate ?? null,
  };
}

/** The evidence for one clause, or undefined when the clause needs none. Null = needed, missing. */
export function matchClauseEvidence(
  clauseText: string,
  ctx: MatchContext,
): DemoCompanyEvidence | null | undefined {
  const need = evidenceNeed(clauseText);
  if (!need) return undefined;
  const p = ctx.profile;

  if (need === 'TURNOVER') {
    const records = (p?.turnover_records ?? []).filter((r) => r.evidence_document_id);
    if (records.length === 0) return null;
    const latest = [...records]
      .sort((a, b) => a.financial_year.localeCompare(b.financial_year))
      .at(-1)!;
    return link(
      `Turnover ${latest.financial_year}`,
      ctx.evidenceById.get(latest.evidence_document_id),
    );
  }
  if (need === 'SIMILAR_WORK') {
    const works = (p?.experience ?? []).filter((e) => e.evidence_document_id);
    if (works.length === 0) return null;
    const best = [...works].sort(
      (a, b) => b.contract_value_inr_crores - a.contract_value_inr_crores,
    )[0]!;
    return link(best.project_name, ctx.evidenceById.get(best.evidence_document_id));
  }
  if (need === 'CERTIFICATE') {
    const named = clauseText.match(/\biso\s*(\d{3,5})/i)?.[1];
    const certs = (p?.certifications ?? []).filter(
      (c) => !named || c.standard_name.replace(/\s+/g, '').toLowerCase().includes(`iso${named}`),
    );
    if (certs.length === 0) return null;
    const cert = certs[0]!;
    const expired = cert.valid_to && ctx.deadline ? new Date(cert.valid_to) < ctx.deadline : false;
    return link(
      cert.standard_name,
      ctx.evidenceById.get(cert.evidence_document_id),
      expired ? 'EXPIRED' : undefined,
      cert.valid_to ?? null,
    );
  }
  // REGISTRATION: the company record's own verified identifiers.
  const c = ctx.company;
  if (!c || !(c.gstin || c.pan || c.udyamId)) return null;
  const verified = Boolean(c.gstinVerifiedAt || c.udyamVerifiedAt || c.mcaVerifiedAt);
  return {
    id: c.id,
    title: 'Company registrations',
    docType: 'REGISTRATION',
    documentName: [
      c.gstin && `GSTIN ${c.gstin}`,
      c.pan && `PAN ${c.pan}`,
      c.udyamId && `Udyam ${c.udyamId}`,
    ]
      .filter(Boolean)
      .join(', '),
    status: verified ? 'VERIFIED' : 'SELF_ATTESTED',
    expiryDate: null,
  };
}
