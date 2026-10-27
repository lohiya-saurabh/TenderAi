/**
 * Clause model: pure functions shared by ingestion, the clause endpoints and the legacy
 * compliance-item endpoints. `null` = not stated in the tender; nothing is defaulted.
 */
import { createHash } from 'node:crypto';
import type {
  AiBand,
  Clause,
  ClauseAttestation,
  ClauseAttributesDto,
  ClauseFacets,
  ClauseFlag,
  FulfilmentStatus,
  QuoteCheck,
  ReviewStatus,
} from '@tenderpulse/shared-types';
import type { ComplianceItem } from '@/common/database/schema.js';

export const REVIEW_STATUSES: ReviewStatus[] = [
  'UNREVIEWED',
  'NEEDS_REVIEW',
  'CONFIRMED',
  'CORRECTED',
  'NOT_A_REQUIREMENT',
];
export const AI_BANDS: AiBand[] = ['SPOT_CHECK', 'CHECK_CAREFULLY', 'REVIEW_REQUIRED'];

export const EMPTY_ATTRIBUTES: ClauseAttributesDto = {
  obligationType: null,
  action: null,
  stage: null,
  parties: [],
  mandatory: null,
  disqualifying: null,
  deadline: null,
  amount: null,
  formRef: null,
};

const norm = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Same formula as the AI's location_key: hash(document, page, normalised quote). */
export function locationKey(documentId: string, page: number, quote: string): string {
  const digest = createHash('sha256')
    .update(`${documentId}|${page}|${norm(quote)}`)
    .digest('hex')
    .slice(0, 24);
  return `cl_${digest}`;
}

/** Stable clause id within a tenant's bid, derived from the location key (never the title). */
export function clauseId(organizationId: string, bidId: string, itemKey: string): string {
  return `cl-${createHash('sha256').update(`${organizationId}:${bidId}:${itemKey}`).digest('hex').slice(0, 40)}`;
}

export function conflictId(organizationId: string, bidId: string, conflictKey: string): string {
  return `cf-${createHash('sha256').update(`${organizationId}:${bidId}:${conflictKey}`).digest('hex').slice(0, 40)}`;
}

/**
 * Server-side quote verification against the stored text of the clause's page(s):
 * EXACT substring, NORMALISED (case/whitespace/hyphenation), NOT_FOUND, or NO_PAGE_TEXT when
 * the page text was never stored (so nothing can be claimed either way).
 */
export function checkQuote(quote: string, pageTexts: string[]): QuoteCheck {
  const texts = pageTexts.filter((t) => t && t.trim());
  if (texts.length === 0) return 'NO_PAGE_TEXT';
  if (!quote.trim()) return 'NOT_FOUND';
  const joined = texts.join('\n');
  if (joined.includes(quote)) return 'EXACT';
  const loose = (s: string) =>
    norm(
      s
        .replace(/-\s*\n\s*/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'"),
    );
  return loose(joined).includes(loose(quote)) ? 'NORMALISED' : 'NOT_FOUND';
}

/**
 * Chunks that hold a page's own text. Skeleton chunks summarise whole sections (text from
 * other pages) and child chunks repeat their parent, so neither is page text.
 */
export function isPageTextChunk(chunkType: string | null | undefined): boolean {
  const t = (chunkType || '').toUpperCase();
  return t !== 'SKELETON' && !t.endsWith('_CHILD');
}

/** Removes the "[section path]" context line the chunker prepends to a chunk. */
export function stripChunkHeading(content: string): string {
  return content.replace(/^\[[^\]\n]*\]\n/, '');
}

interface StoredRules {
  stampPaperRequired?: boolean | null;
  stampPaperDenominationInr?: number | null;
  notarizationRequired?: boolean | null;
  udinRequired?: boolean | null;
  apostilleRequired?: boolean | null;
  clientCountersignRequired?: boolean | null;
  signingAuthorityRank?: string | null;
}

const tri = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function toAttestation(rules: unknown): ClauseAttestation {
  const r = (rules ?? {}) as StoredRules;
  const rank = typeof r.signingAuthorityRank === 'string' ? r.signingAuthorityRank.trim() : '';
  return {
    stampPaper: tri(r.stampPaperRequired),
    stampDenominationInr:
      typeof r.stampPaperDenominationInr === 'number' && r.stampPaperDenominationInr > 0
        ? r.stampPaperDenominationInr
        : null,
    notarised: tri(r.notarizationRequired),
    udin: tri(r.udinRequired),
    apostille: tri(r.apostilleRequired),
    clientCountersign: tri(r.clientCountersignRequired),
    signatoryRank: rank || null,
  };
}

/**
 * How much checking a clause needs. SPOT_CHECK only when the quote was found on the page,
 * every validation check passed, nothing is flagged and the clause is not disqualifying.
 */
export function computeAiBand(input: {
  quoteCheck: QuoteCheck;
  confidence: number | null;
  flags: ClauseFlag[];
  disqualifying: true | null;
}): AiBand {
  const { quoteCheck, confidence, flags, disqualifying } = input;
  if (
    quoteCheck === 'NOT_FOUND' ||
    flags.includes('CONFLICT') ||
    flags.includes('QUOTE_NOT_FOUND') ||
    flags.includes('NEAR_FAILED_PAGE')
  ) {
    return 'REVIEW_REQUIRED';
  }
  if (
    (quoteCheck === 'EXACT' || quoteCheck === 'NORMALISED') &&
    confidence !== null &&
    confidence >= 0.999 &&
    flags.length === 0 &&
    disqualifying !== true
  ) {
    return 'SPOT_CHECK';
  }
  return 'CHECK_CAREFULLY';
}

/** A confirmation of this clause requires the reviewer to have opened the source. */
export function requiresSourceForConfirm(
  clause: Pick<Clause, 'aiBand' | 'disqualifying' | 'flags'>,
): boolean {
  return clause.aiBand !== 'SPOT_CHECK' || clause.disqualifying === true || clause.flags.length > 0;
}

/**
 * Legacy single status (old endpoints / old rows) -> the two axes. The same mapping runs in
 * the DDL migration for stored rows.
 */
export function mapLegacyStatus(
  status: string,
  reviewedByHuman: boolean,
): { review: ReviewStatus; fulfilment: FulfilmentStatus } {
  const s = (status || '').toUpperCase();
  const fulfilment: FulfilmentStatus =
    ['PASS', 'APPROVED', 'COMPLIANT'].includes(s) && reviewedByHuman
      ? 'DONE'
      : ['FAIL', 'NON_COMPLIANT'].includes(s)
        ? 'AT_RISK'
        : ['WAIVED', 'NOT_APPLICABLE', 'NA'].includes(s)
          ? 'NOT_APPLICABLE'
          : 'NOT_STARTED';
  if (!reviewedByHuman) {
    return {
      review: ['REVIEW_REQUIRED', 'PENDING_REVIEW', 'UNDER_REVIEW'].includes(s)
        ? 'NEEDS_REVIEW'
        : 'UNREVIEWED',
      fulfilment,
    };
  }
  if (
    [
      'PASS',
      'APPROVED',
      'COMPLIANT',
      'READY',
      'FAIL',
      'NON_COMPLIANT',
      'MISSING',
      'WAIVED',
      'NOT_APPLICABLE',
      'NA',
    ].includes(s)
  ) {
    return { review: 'CONFIRMED', fulfilment };
  }
  if (['REVIEW_REQUIRED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'FLAGGED'].includes(s)) {
    return { review: 'NEEDS_REVIEW', fulfilment };
  }
  if (['REJECTED', 'NOT_A_REQUIREMENT'].includes(s)) {
    return { review: 'NOT_A_REQUIREMENT', fulfilment };
  }
  return { review: 'UNREVIEWED', fulfilment };
}

/** Review axis -> the legacy status the old compliance-item UI still reads. */
export function legacyStatusFor(review: ReviewStatus, current: string): string {
  switch (review) {
    case 'NEEDS_REVIEW':
      return 'REVIEW_REQUIRED';
    case 'NOT_A_REQUIREMENT':
      return 'NOT_APPLICABLE';
    case 'UNREVIEWED':
      return 'PENDING';
    default:
      // CONFIRMED / CORRECTED say the clause is read correctly, not that it is met.
      return current === 'PENDING' || current === 'FLAGGED' || current === 'REVIEW_REQUIRED'
        ? 'PENDING'
        : current;
  }
}

interface StoredProvenance {
  documentId?: string | null;
  sourceDocumentId?: string | null;
  documentName?: string | null;
  sourceFileName?: string | null;
  pageNumber?: number | null;
  clauseReference?: string | null;
  verbatimQuote?: string | null;
  confidenceScore?: number | null;
}

/**
 * Stored row -> API clause projection. `conflictIds` lists every conflict the clause is part
 * of; the CONFLICT flag is shown only while one of them is unresolved.
 */
export function toClause(
  row: ComplianceItem,
  conflictIds: string[] = [],
  hasUnresolvedConflict = false,
): Clause {
  const prov = (row.provenance ?? {}) as StoredProvenance;
  const attrs = {
    ...EMPTY_ATTRIBUTES,
    ...((row.attributes as ClauseAttributesDto | null) ?? {}),
  };
  const flags: ClauseFlag[] = ((row.flags as ClauseFlag[] | null) ?? []).filter(
    (f) => f !== 'CONFLICT',
  );
  const quoteCheck = (row.quoteCheck as QuoteCheck) || 'NO_PAGE_TEXT';
  if (quoteCheck === 'NOT_FOUND' && !flags.includes('QUOTE_NOT_FOUND'))
    flags.push('QUOTE_NOT_FOUND');
  if (hasUnresolvedConflict) flags.push('CONFLICT');
  const confidence =
    typeof prov.confidenceScore === 'number' && Number.isFinite(prov.confidenceScore)
      ? prov.confidenceScore
      : null;
  const disqualifying = attrs.disqualifying === true ? true : null;
  const page = row.primaryPage ?? (typeof prov.pageNumber === 'number' ? prov.pageNumber : 0);
  const reviewStatus = (row.reviewStatus as ReviewStatus) || 'UNREVIEWED';
  return {
    id: row.id,
    bidId: row.bidId,
    documentId: row.documentId ?? prov.documentId ?? prov.sourceDocumentId ?? null,
    documentName: prov.documentName ?? prov.sourceFileName ?? null,
    docOrder: row.docOrder ?? 0,
    title: row.title,
    summary: row.description?.trim() ? row.description : null,
    quote: prov.verbatimQuote ?? '',
    quoteCheck,
    pages: {
      primary: page,
      supporting: ((row.supportingPages as number[] | null) ?? []).slice(),
    },
    clauseRef: row.clauseRef ?? null,
    sourceBlockId: row.sourceBlockId ?? null,
    category: row.category,
    obligationType: attrs.obligationType,
    action: attrs.action,
    stage: attrs.stage,
    parties: attrs.parties ?? [],
    mandatory: attrs.mandatory,
    disqualifying,
    deadline: attrs.deadline,
    amount: attrs.amount,
    formRef: attrs.formRef,
    attestation: toAttestation(row.executionRules),
    aiBand: computeAiBand({ quoteCheck, confidence, flags, disqualifying }),
    confidence: {
      value: confidence,
      source: confidence === null ? null : 'VALIDATION',
    },
    flags,
    conflictIds,
    review: {
      status: reviewStatus,
      by:
        row.reviewedBy && reviewStatus !== 'UNREVIEWED'
          ? { id: row.reviewedBy, name: row.reviewedByName || row.reviewedBy }
          : null,
      at:
        row.reviewedAt && reviewStatus !== 'UNREVIEWED'
          ? new Date(row.reviewedAt).toISOString()
          : null,
      note: row.reviewNotes ?? null,
      version: row.version,
    },
    fulfilment: {
      status: (row.fulfilmentStatus as FulfilmentStatus) || 'NOT_STARTED',
      ownerId: row.fulfilmentOwnerId ?? null,
    },
  };
}

/** Document reading order: document upload order, then the AI's docOrder, then page. */
export function compareDocOrder(docRank: Map<string, number>): (a: Clause, b: Clause) => number {
  return (a, b) =>
    (docRank.get(a.documentId ?? '') ?? 1e9) - (docRank.get(b.documentId ?? '') ?? 1e9) ||
    a.pages.primary - b.pages.primary ||
    a.docOrder - b.docOrder ||
    a.id.localeCompare(b.id);
}

export function buildFacets(clauses: Clause[]): ClauseFacets {
  const facets: ClauseFacets = {
    reviewStatus: Object.fromEntries(
      REVIEW_STATUSES.map((s) => [s, 0]),
    ) as ClauseFacets['reviewStatus'],
    aiBand: Object.fromEntries(AI_BANDS.map((s) => [s, 0])) as ClauseFacets['aiBand'],
    flags: {},
    obligationType: {},
    stage: {},
    category: {},
  };
  for (const c of clauses) {
    facets.reviewStatus[c.review.status] += 1;
    facets.aiBand[c.aiBand] += 1;
    for (const f of c.flags) facets.flags[f] = (facets.flags[f] ?? 0) + 1;
    const ot = c.obligationType ?? 'NOT_STATED';
    facets.obligationType[ot] = (facets.obligationType[ot] ?? 0) + 1;
    const st = c.stage ?? 'NOT_STATED';
    facets.stage[st] = (facets.stage[st] ?? 0) + 1;
    facets.category[c.category] = (facets.category[c.category] ?? 0) + 1;
  }
  return facets;
}
