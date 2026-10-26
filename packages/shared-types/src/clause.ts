/**
 * Clause contract shared by the AI service (wire payload), the API (persistence and
 * endpoints) and the web app. One rule throughout: `null` means "not stated in the
 * tender". Nothing is defaulted or invented; a value is shown only when the tender
 * text supports it.
 *
 * The AI side is validated against `schema/extraction-completed.schema.json` (pytest),
 * which mirrors the wire types in this file.
 */

/** true = required, false = explicitly not required, null = the clause does not say */
export type Tri = boolean | null;

export type ObligationType =
  | 'ELIGIBILITY'
  | 'DOCUMENT'
  | 'FORMALITY'
  | 'DEADLINE'
  | 'FINANCIAL_COMMITMENT'
  | 'PENALTY'
  | 'COVENANT'
  | 'INFO';
export type ClauseAction = 'ATTACH_DOCUMENT' | 'PRICE_IN_BOQ' | 'UNDERTAKE' | 'INFO_ONLY';
export type ClauseStage =
  | 'PRE_BID'
  | 'WITH_BID_ONLINE'
  | 'WITH_BID_PHYSICAL'
  | 'ON_CLARIFICATION'
  | 'POST_AWARD'
  | 'EXECUTION';
export type ResponsibleParty =
  | 'BIDDER'
  | 'CA_AUDITOR'
  | 'PAST_CLIENT'
  | 'NOTARY'
  | 'BANK'
  | 'JV_PARTNER';
export type DeadlineAnchor = 'BID_DUE' | 'LOA' | 'AWARD' | 'AGREEMENT' | 'BID_END';

export interface ClauseDeadline {
  kind: 'ABSOLUTE' | 'RELATIVE';
  /** As written in the tender (ABSOLUTE) */
  date: string | null;
  anchor: DeadlineAnchor | null;
  offsetDays: number | null;
}

export interface ClauseAmount {
  inr: number | null;
  percent: number | null;
  /** What the percent applies to, as stated ("contract value") */
  basis: string | null;
}

/** Bidder-task attributes; every number is grounded in the quote by the AI. */
export interface ClauseAttributesDto {
  obligationType: ObligationType | null;
  action: ClauseAction | null;
  stage: ClauseStage | null;
  parties: ResponsibleParty[];
  mandatory: 'MANDATORY' | 'DESIRABLE' | null;
  disqualifying: true | null;
  deadline: ClauseDeadline | null;
  amount: ClauseAmount | null;
  /** Form / appendix the clause points to, e.g. "Appendix XI" */
  formRef: string | null;
}

export interface ClauseAttestation {
  stampPaper: Tri;
  stampDenominationInr: number | null;
  notarised: Tri;
  udin: Tri;
  apostille: Tri;
  clientCountersign: Tri;
  signatoryRank: string | null;
}

export type ClauseFlag =
  | 'CONFLICT'
  | 'QUOTE_NOT_FOUND'
  | 'NEAR_FAILED_PAGE'
  | 'MISSING_FIELDS'
  | 'AMENDED'
  | 'BUYER_ADDED';

/** Server-side check of the quote against the stored page text */
export type QuoteCheck = 'EXACT' | 'NORMALISED' | 'NOT_FOUND' | 'NO_PAGE_TEXT';

/** How much checking a clause needs before it can be confirmed */
export type AiBand = 'SPOT_CHECK' | 'CHECK_CAREFULLY' | 'REVIEW_REQUIRED';

export type ReviewStatus =
  | 'UNREVIEWED'
  | 'NEEDS_REVIEW'
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'NOT_A_REQUIREMENT';
export type FulfilmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'EVIDENCE_ATTACHED'
  | 'DONE'
  | 'AT_RISK'
  | 'NOT_APPLICABLE';

// ───────────────────────────── Wire (AI → API) ─────────────────────────────

export interface WireConflictValue {
  /** The tender's value as a short display string ("3%") */
  display: string;
  /** itemKey of the clause stating this value */
  itemKey: string;
  /** Verbatim tender text */
  quote: string;
  page: number;
  clauseRef: string | null;
}

export interface WireConflictDto {
  conflictKey: string;
  topic: string;
  attribute: string;
  values: WireConflictValue[];
  /** Generated reasoning — never shown as tender text */
  aiPrecedenceNote: string | null;
}

export interface WireCoverageDto {
  documentId: string;
  pageCount: number;
  failedPages: { page: number; reason: string }[];
  status: 'COMPLETE' | 'PARTIAL';
}

// ───────────────────────────── API (projection for the UI) ─────────────────────────────

export interface ClauseReview {
  status: ReviewStatus;
  by: { id: string; name: string } | null;
  at: string | null;
  note: string | null;
  version: number;
}

export interface Clause {
  /** Location identity: hash(document, page, quote). Never derived from the title. */
  id: string;
  bidId: string;
  documentId: string | null;
  documentName: string | null;
  docOrder: number;
  title: string;
  /** AI plain-language statement (labelled "AI summary" in the UI) */
  summary: string | null;
  /** Verbatim tender text, never generated */
  quote: string;
  quoteCheck: QuoteCheck;
  pages: { primary: number; supporting: number[] };
  clauseRef: string | null;
  sourceBlockId: string | null;
  category: string;
  obligationType: ObligationType | null;
  action: ClauseAction | null;
  stage: ClauseStage | null;
  parties: ResponsibleParty[];
  mandatory: 'MANDATORY' | 'DESIRABLE' | null;
  disqualifying: true | null;
  deadline: ClauseDeadline | null;
  amount: ClauseAmount | null;
  formRef: string | null;
  attestation: ClauseAttestation;
  aiBand: AiBand;
  /** Deterministic validation score; source null when not computed. Never a model self-report. */
  confidence: { value: number | null; source: 'VALIDATION' | null };
  flags: ClauseFlag[];
  conflictIds: string[];
  review: ClauseReview;
  fulfilment: { status: FulfilmentStatus; ownerId: string | null };
}

export interface ClauseHistoryEvent {
  at: string;
  by: { id: string; name: string } | null;
  kind: string;
  detail: Record<string, unknown>;
}

export interface ClauseDetail extends Clause {
  /** Text of the source page around the quote (null when the page text is not stored) */
  context: { before: string; after: string } | null;
  conflicts: Conflict[];
  history: ClauseHistoryEvent[];
  prevId: string | null;
  nextId: string | null;
}

export type ConflictResolution =
  | 'UNRESOLVED'
  | 'ACCEPTED_VALUE'
  | 'QUERY_RAISED'
  | 'RESOLVED_BY_CORRIGENDUM';

export interface Conflict {
  id: string;
  topic: string;
  attribute: string;
  values: {
    display: string;
    clauseId: string;
    quote: string;
    page: number;
    clauseRef: string | null;
  }[];
  aiPrecedenceNote: string | null;
  resolution: ConflictResolution;
  chosenClauseId: string | null;
  note: string | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  version: number;
}

export type CoverageStatus = 'COMPLETE' | 'PARTIAL' | 'RUNNING' | 'FAILED' | 'NOT_ANALYSED' | 'UNKNOWN';

export interface Coverage {
  documents: {
    id: string;
    name: string;
    pageCount: number | null;
    failedPages: { page: number; reason: string }[];
    /** UNKNOWN: analysed before page coverage was recorded */
    status: CoverageStatus;
  }[];
  status: CoverageStatus;
}

export interface ClauseFacets {
  reviewStatus: Record<ReviewStatus, number>;
  aiBand: Record<AiBand, number>;
  flags: Partial<Record<ClauseFlag, number>>;
  obligationType: Partial<Record<ObligationType | 'NOT_STATED', number>>;
  stage: Partial<Record<ClauseStage | 'NOT_STATED', number>>;
  category: Record<string, number>;
}

export interface ClauseListResponse {
  clauses: Clause[];
  total: number;
  facets: ClauseFacets;
}

/** UNREVIEW undoes the last decision (status only; corrections stay in the history). */
export type ReviewAction = 'CONFIRM' | 'CORRECT' | 'NOT_A_REQUIREMENT' | 'NEEDS_REVIEW' | 'UNREVIEW';

export interface ClauseReviewRequest {
  action: ReviewAction;
  /** Fields the reviewer corrected (CORRECT only); null clears a value the AI got wrong */
  corrections?: Partial<
    Pick<
      Clause,
      | 'title'
      | 'summary'
      | 'clauseRef'
      | 'obligationType'
      | 'action'
      | 'stage'
      | 'mandatory'
      | 'deadline'
      | 'amount'
      | 'formRef'
    >
  >;
  note?: string;
  /** The reviewer opened the source page before confirming */
  sourceOpened: boolean;
  expectedVersion: number;
}

export interface BulkReviewRequest {
  action: 'CONFIRM';
  clauseIds: string[];
}

export interface ConflictResolutionRequest {
  resolution: ConflictResolution;
  chosenClauseId?: string;
  note?: string;
  expectedVersion: number;
}

export interface BidClauseSummary {
  documents: number;
  clauses: number;
  review: Record<ReviewStatus, number>;
  conflicts: { total: number; unresolved: number };
  coverage: Coverage['status'];
  pagesNotAnalysed: number;
  attention: {
    conflicts: number;
    pagesNotAnalysed: number;
    disqualifyingUnreviewed: number;
    quoteNotFound: number;
    needsOutsideParty: number;
  };
  deadlines: { clauseId: string; title: string; deadline: ClauseDeadline; clauseRef: string | null; page: number }[];
  amounts: { clauseId: string; title: string; amount: ClauseAmount; clauseRef: string | null; page: number }[];
}

export interface DocumentPageText {
  documentId: string;
  page: number;
  /** Stored text blocks of the page in reading order (text layer for the viewer) */
  blocks: { id: string; text: string; clauseRef: string | null; boundingBox: unknown }[];
}
