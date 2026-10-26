/**
 * Display text for clause fields. Every label describes what the tender (or a reviewer)
 * said; a missing value is shown as "Not stated", never filled in.
 */
import type {
  AiBand,
  Clause,
  ClauseAmount,
  ClauseDeadline,
  ClauseFlag,
  ClauseStage,
  ObligationType,
  QuoteCheck,
  ResponsibleParty,
  ReviewStatus,
} from '@tenderpulse/shared-types';

export const NOT_STATED = 'Not stated';

export const STAGE_LABEL: Record<ClauseStage, string> = {
  PRE_BID: 'Pre-bid',
  WITH_BID_ONLINE: 'With bid · online',
  WITH_BID_PHYSICAL: 'With bid · physical',
  ON_CLARIFICATION: 'On clarification',
  POST_AWARD: 'Post-award',
  EXECUTION: 'Execution',
};

export const OBLIGATION_LABEL: Record<ObligationType, string> = {
  ELIGIBILITY: 'Eligibility',
  DOCUMENT: 'Document',
  FORMALITY: 'Formality',
  DEADLINE: 'Deadline',
  FINANCIAL_COMMITMENT: 'Financial',
  PENALTY: 'Penalty',
  COVENANT: 'Covenant',
  INFO: 'Info',
};

export const ACTION_LABEL: Record<NonNullable<Clause['action']>, string> = {
  ATTACH_DOCUMENT: 'Attach',
  PRICE_IN_BOQ: 'Price in BoQ',
  UNDERTAKE: 'Undertake',
  INFO_ONLY: 'Info only',
};

export const PARTY_LABEL: Record<ResponsibleParty, string> = {
  BIDDER: 'Bidder',
  CA_AUDITOR: 'CA / auditor',
  PAST_CLIENT: 'Past client',
  NOTARY: 'Notary',
  BANK: 'Bank',
  JV_PARTNER: 'JV partner',
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  UNREVIEWED: 'Unreviewed',
  NEEDS_REVIEW: 'Needs review',
  CONFIRMED: 'Confirmed',
  CORRECTED: 'Corrected',
  NOT_A_REQUIREMENT: 'Not a requirement',
};

export const BAND_LABEL: Record<AiBand, string> = {
  SPOT_CHECK: 'AI · spot-check',
  CHECK_CAREFULLY: 'AI · check carefully',
  REVIEW_REQUIRED: 'AI · review required',
};

export const FLAG_LABEL: Record<ClauseFlag, string> = {
  CONFLICT: 'Conflict',
  QUOTE_NOT_FOUND: 'Quote not found',
  NEAR_FAILED_PAGE: 'Near unread page',
  MISSING_FIELDS: 'Missing fields',
  AMENDED: 'Amended',
  BUYER_ADDED: 'Buyer-added',
};

export const QUOTE_CHECK_LABEL = (check: QuoteCheck, page: number): string =>
  ({
    EXACT: `Found on p.${page}`,
    NORMALISED: `Found on p.${page} (spacing differs)`,
    NOT_FOUND: `Not found in parsed text of p.${page}`,
    NO_PAGE_TEXT: `Page text not stored for p.${page}`,
  })[check];

const ANCHOR_LABEL: Record<string, string> = {
  BID_DUE: 'bid due date',
  LOA: 'LOA',
  AWARD: 'award',
  AGREEMENT: 'agreement',
  BID_END: 'bid end',
};

export function formatDeadline(d: ClauseDeadline | null, short = false): string {
  if (!d) return NOT_STATED;
  if (d.kind === 'ABSOLUTE') return d.date ?? NOT_STATED;
  const anchor = ANCHOR_LABEL[d.anchor ?? ''] ?? (d.anchor || 'event');
  if (short)
    return `${d.anchor === 'BID_DUE' ? 'BDD' : (d.anchor ?? '')} + ${d.offsetDays ?? '?'} d`;
  return `${d.offsetDays ?? '?'} days after ${anchor}`;
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatInr(value: number): string {
  if (value >= 1e7) return `₹${INR.format(value / 1e7)} Cr`;
  if (value >= 1e5) return `₹${INR.format(value / 1e5)} L`;
  return `₹${INR.format(value)}`;
}

export function formatAmount(a: ClauseAmount | null): string {
  if (!a) return NOT_STATED;
  const parts: string[] = [];
  if (a.inr != null) parts.push(formatInr(a.inr));
  if (a.percent != null)
    parts.push(`${a.percent}%${a.basis ? ` of ${a.basis}` : ', base not stated'}`);
  return parts.length ? parts.join(' · ') : NOT_STATED;
}

/** "2.1 · p.3", "No clause no. · p.7" */
export function refLabel(c: Pick<Clause, 'clauseRef' | 'pages'>): string {
  const page = c.pages.primary > 0 ? `p.${c.pages.primary}` : 'no page';
  return `${c.clauseRef ?? 'No clause no.'} · ${page}`;
}

/** Attestation chips: only formalities the clause states as required. */
export function attestationChips(c: Pick<Clause, 'attestation'>): string[] {
  const a = c.attestation;
  const chips: string[] = [];
  if (a.stampPaper === true) {
    chips.push(a.stampDenominationInr ? `Stamp ₹${a.stampDenominationInr}` : 'Stamp paper');
  }
  if (a.notarised === true) chips.push('Notarised');
  if (a.udin === true) chips.push('UDIN');
  if (a.apostille === true) chips.push('Apostille');
  if (a.clientCountersign === true) chips.push('Client countersign');
  if (a.signatoryRank) chips.push(`Signed by ${a.signatoryRank}`);
  return chips;
}

export function typeLabel(c: Pick<Clause, 'obligationType' | 'action'>): string | null {
  if (!c.obligationType && !c.action) return null;
  return [
    c.obligationType ? OBLIGATION_LABEL[c.obligationType] : null,
    c.action ? ACTION_LABEL[c.action] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Fields this clause does not state (shown as one collapsed line in the panel). */
export function notStatedFields(c: Clause): string[] {
  const missing: string[] = [];
  if (!c.clauseRef) missing.push('clause number');
  if (!c.obligationType) missing.push('obligation type');
  if (!c.stage) missing.push('stage');
  if (!c.deadline) missing.push('deadline');
  if (!c.amount) missing.push('amount');
  if (!c.mandatory) missing.push('mandatory / desirable');
  if (attestationChips(c).length === 0) missing.push('attestation');
  return missing;
}
