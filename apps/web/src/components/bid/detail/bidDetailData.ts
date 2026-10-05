/**
 * TenderPulse AI — Tender Detail Derivations
 *
 * Pure functions over the existing API contract:
 *   - BidDetail        from GET /api/v1/bids/:id
 *   - ComplianceItem[] from GET /api/v1/bids/:id/compliance-items
 *   - BidDecisionSummary from GET /api/v1/bids/:id/bid-decision
 *
 * The bid/no-bid recommendation (PURSUE / DO_NOT_PURSUE /
 * REVIEW_REQUIRED) is produced by the deterministic eligibility
 * engine evaluating the Company Capability Profile against this
 * tender. The backend now exposes GET /api/v1/bids/:id/bid-decision
 * returning a BidDecisionSummary with verdict GO/CONDITIONAL_GO/
 * NO_GO/REVIEW_REQUIRED. This module maps those to the frontend
 * PURSUE/DO_NOT_PURSUE/REVIEW_REQUIRED framework.
 */

import type { BidDetail } from '../../../api/bids.js';
import type { ComplianceItem } from '../../../api/compliance.js';
import type { BidDecisionSummary, BidVerdict, BidDecisionState } from '../../../api/bids.js';
import { computeReadiness, type ReadinessSummary } from '../../../utils/readiness.js';

// ---------------------------------------------------------------------------
// Bid decision types (mapped from API)
// ---------------------------------------------------------------------------

export type BidRecommendation = 'PURSUE' | 'DO_NOT_PURSUE' | 'REVIEW_REQUIRED';

/**
 * Frontend-friendly decision view mapped from the API response.
 * The API returns:
 *   - verdict: GO | CONDITIONAL_GO | NO_GO | REVIEW_REQUIRED
 *   - state: AI_PROPOSED | UNDER_REVIEW | CONFIRMED | OVERRIDDEN
 *   - readinessScore: 0.0–1.0
 *   - reasonsToPursue, reasonsNotToPursue, hardDisqualifiers,
 *     missingInformation, uncertainAreas, commercialRisks,
 *     evidenceCitations, reviewTriggers
 */
export interface BidDecision {
  bidId: string;
  decisionId?: string;
  profileVersionId?: string;
  verdict: BidRecommendation;
  state?: BidDecisionState;
  readinessScore?: number;
  /** Human-readable, evidence-backed reasons for the verdict */
  reasons: string[];
  reasonsToPursue?: unknown[];
  reasonsNotToPursue?: unknown[];
  hardDisqualifiers?: unknown[];
  missingInformation?: unknown[];
  uncertainAreas?: unknown[];
  commercialRisks?: unknown[];
  evidenceCitations?: unknown[];
  reviewTriggers?: unknown[];
  evaluatedAt: string;
  evaluatedFactors: number;
}

/**
 * Map the engine's verdict (GO/CONDITIONAL_GO/NO_GO/REVIEW_REQUIRED)
 * to the frontend recommendation framework.
 *
 * - GO / CONDITIONAL_GO → PURSUE (CONDITIONAL_GO shows conditions)
 * - NO_GO → DO_NOT_PURSUE
 * - REVIEW_REQUIRED → REVIEW_REQUIRED
 */
export function mapVerdict(verdict: BidVerdict): BidRecommendation {
  switch (verdict) {
    case 'GO':
    case 'CONDITIONAL_GO':
      return 'PURSUE';
    case 'NO_GO':
      return 'DO_NOT_PURSUE';
    case 'REVIEW_REQUIRED':
      return 'REVIEW_REQUIRED';
  }
}

/**
 * Extract human-readable reasons from the decision response.
 * Combines reasonsToPursue, reasonsNotToPursue, hardDisqualifiers,
 * missingInformation, and uncertainAreas into a flat string array.
 */
export function extractReasons(decision: BidDecisionSummary): string[] {
  const reasons: string[] = [];

  if (decision.reasonsToPursue && decision.reasonsToPursue.length > 0) {
    decision.reasonsToPursue.forEach((r) => {
      if (typeof r === 'string') reasons.push(`✓ ${r}`);
      else if (r && typeof r === 'object' && 'reason' in r) reasons.push(`✓ ${(r as { reason: string }).reason}`);
      else reasons.push(`✓ ${JSON.stringify(r)}`);
    });
  }

  if (decision.hardDisqualifiers && decision.hardDisqualifiers.length > 0) {
    decision.hardDisqualifiers.forEach((r) => {
      if (typeof r === 'string') reasons.push(`✗ ${r} (hard disqualifier)`);
      else if (r && typeof r === 'object' && 'reason' in r) reasons.push(`✗ ${(r as { reason: string }).reason} (hard disqualifier)`);
      else reasons.push(`✗ ${JSON.stringify(r)} (hard disqualifier)`);
    });
  }

  if (decision.reasonsNotToPursue && decision.reasonsNotToPursue.length > 0) {
    decision.reasonsNotToPursue.forEach((r) => {
      if (typeof r === 'string') reasons.push(`✗ ${r}`);
      else if (r && typeof r === 'object' && 'reason' in r) reasons.push(`✗ ${(r as { reason: string }).reason}`);
      else reasons.push(`✗ ${JSON.stringify(r)}`);
    });
  }

  if (decision.missingInformation && decision.missingInformation.length > 0) {
    decision.missingInformation.forEach((r) => {
      if (typeof r === 'string') reasons.push(`? ${r} (missing information)`);
      else if (r && typeof r === 'object' && 'detail' in r) reasons.push(`? ${(r as { detail: string }).detail} (missing information)`);
      else reasons.push(`? ${JSON.stringify(r)} (missing information)`);
    });
  }

  if (decision.uncertainAreas && decision.uncertainAreas.length > 0) {
    decision.uncertainAreas.forEach((r) => {
      if (typeof r === 'string') reasons.push(`? ${r} (uncertain)`);
      else if (r && typeof r === 'object' && 'detail' in r) reasons.push(`? ${(r as { detail: string }).detail} (uncertain)`);
      else reasons.push(`? ${JSON.stringify(r)} (uncertain)`);
    });
  }

  if (decision.commercialRisks && decision.commercialRisks.length > 0) {
    decision.commercialRisks.forEach((r) => {
      if (typeof r === 'string') reasons.push(`⚠ ${r} (commercial risk)`);
      else if (r && typeof r === 'object' && 'detail' in r) reasons.push(`⚠ ${(r as { detail: string }).detail} (commercial risk)`);
      else reasons.push(`⚠ ${JSON.stringify(r)} (commercial risk)`);
    });
  }

  return reasons;
}

/**
 * Convert the API BidDecisionSummary to the frontend BidDecision view.
 */
export function toBidDecision(apiDecision: BidDecisionSummary): BidDecision {
  return {
    bidId: apiDecision.bidId,
    decisionId: apiDecision.decisionId,
    profileVersionId: apiDecision.profileVersionId,
    verdict: mapVerdict(apiDecision.verdict),
    state: apiDecision.state,
    readinessScore: apiDecision.readinessScore,
    reasons: extractReasons(apiDecision),
    reasonsToPursue: apiDecision.reasonsToPursue,
    reasonsNotToPursue: apiDecision.reasonsNotToPursue,
    hardDisqualifiers: apiDecision.hardDisqualifiers,
    missingInformation: apiDecision.missingInformation,
    uncertainAreas: apiDecision.uncertainAreas,
    commercialRisks: apiDecision.commercialRisks,
    evidenceCitations: apiDecision.evidenceCitations,
    reviewTriggers: apiDecision.reviewTriggers,
    evaluatedAt: apiDecision.evaluatedAt,
    evaluatedFactors:
      apiDecision.reasonsToPursue.length +
      apiDecision.reasonsNotToPursue.length +
      apiDecision.hardDisqualifiers.length +
      apiDecision.missingInformation.length +
      apiDecision.commercialRisks.length,
  };
}

// ---------------------------------------------------------------------------
// Compliance rollup
// ---------------------------------------------------------------------------

export interface ComplianceRollup {
  total: number;
  pending: number;
  ready: number;
  flagged: number;
  waived: number;
  /** Items explicitly marked humanReviewRequired */
  reviewRequired: number;
  /** Items awaiting any human action: PENDING or humanReviewRequired */
  reviewNeeded: number;
  readiness: ReadinessSummary;
}

/** Roll up the requirement matrix into the counts the detail page shows. */
export function getComplianceRollup(
  items: ComplianceItem[],
  bid: Pick<BidDetail, 'totalRequirements' | 'approvedRequirements' | 'flaggedRequirements'>,
): ComplianceRollup {
  const getStatus = (item: ComplianceItem): string => item.status;

  return {
    total: items.length,
    // New statuses: PASS, FAIL, MISSING, REVIEW_REQUIRED, NOT_APPLICABLE
    // Old statuses: PENDING, READY, FLAGGED, WAIVED
    pending: items.filter((i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING').length,
    ready: items.filter((i) => getStatus(i) === 'READY' || getStatus(i) === 'PASS').length,
    flagged: items.filter((i) => getStatus(i) === 'FLAGGED' || getStatus(i) === 'FAIL').length,
    waived: items.filter((i) => getStatus(i) === 'WAIVED' || getStatus(i) === 'NOT_APPLICABLE').length,
    reviewRequired: items.filter((i) => i.humanReviewRequired).length,
    reviewNeeded: items.filter((i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING' || i.humanReviewRequired).length,
    readiness: computeReadiness(bid),
  };
}

// ---------------------------------------------------------------------------
// Statutory obligations (aggregated from real execution rules)
// ---------------------------------------------------------------------------

export interface ObligationsSummary {
  /** Requirements mandating non-judicial stamp paper */
  stampPaperCount: number;
  /** Highest mandated stamp paper denomination (INR), or null */
  maxStampDenominationInr: number | null;
  /** Requirements mandating notarization / attestation */
  notarizationCount: number;
  /** Requirements mandating a CA certificate with UDIN */
  udinCount: number;
  /** Distinct signing authority ranks mandated (e.g. "Director", "Partner") */
  signingAuthorityRanks: string[];
}

/** Aggregate execution rules across the requirement matrix. */
export function getObligationsSummary(items: ComplianceItem[]): ObligationsSummary {
  let maxStampDenominationInr: number | null = null;
  const signingAuthorityRanks = new Set<string>();

  let stampPaperCount = 0;
  let notarizationCount = 0;
  let udinCount = 0;

  for (const item of items) {
    const rules = item.executionRules;
    if (!rules) continue;

    if (rules.stampPaperRequired) {
      stampPaperCount += 1;
      const denomination = rules.stampPaperDenominationInr;
      if (
        denomination != null &&
        (maxStampDenominationInr === null || denomination > maxStampDenominationInr)
      ) {
        maxStampDenominationInr = denomination;
      }
    }
    if (rules.notarizationRequired) notarizationCount += 1;
    if (rules.udinRequired) udinCount += 1;
    if (rules.signingAuthorityRank) signingAuthorityRanks.add(rules.signingAuthorityRank);
  }

  return {
    stampPaperCount,
    maxStampDenominationInr,
    notarizationCount,
    udinCount,
    signingAuthorityRanks: Array.from(signingAuthorityRanks).sort(),
  };
}

// ---------------------------------------------------------------------------
// Review-needed and flagged selections
// ---------------------------------------------------------------------------

/**
 * Requirements awaiting human action: PENDING/MISSING (not yet reviewed)
 * or explicitly marked humanReviewRequired. Sorted with PENDING/MISSING
 * first, then flagged, then alphabetically by requirement.
 */
export function getReviewNeededItems(items: ComplianceItem[]): ComplianceItem[] {
  const getTitle = (item: ComplianceItem) => (item as any).title || item.requirement;
  const getStatus = (item: ComplianceItem): string => item.status;

  return items
    .filter((i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING' || i.humanReviewRequired)
    .sort((a, b) => {
      const aPending = getStatus(a) === 'PENDING' || getStatus(a) === 'MISSING' ? 0 : 1;
      const bPending = getStatus(b) === 'PENDING' || getStatus(b) === 'MISSING' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return getTitle(a).localeCompare(getTitle(b));
    });
}

/** Requirements flagged by review — the real "missing / insufficient evidence" signal. */
export function getFlaggedItems(items: ComplianceItem[]): ComplianceItem[] {
  const getTitle = (item: ComplianceItem) => (item as any).title || item.requirement;
  const getStatus = (item: ComplianceItem): string => item.status;

  return items
    .filter((i) => getStatus(i) === 'FLAGGED' || getStatus(i) === 'FAIL')
    .sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
}

// ---------------------------------------------------------------------------
// Deadline buffer (real input signal for the future decision engine)
// ---------------------------------------------------------------------------

/** Whole days between now and the submission deadline; null when unspecified. */
export function getDeadlineBufferDays(bid: BidDetail, nowMs: number): number | null {
  if (!bid.submissionDeadline) return null;
  const deadlineMs = new Date(bid.submissionDeadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;
  return Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Bid decision mapping (API response → web BidDecision)
// ---------------------------------------------------------------------------

/** Wire format from GET/POST /api/v1/bids/:id/bid-decision (BidsController.toDecisionWire) */
export interface ApiBidDecisionSummary {
  decisionId: string;
  bidId: string;
  profileVersionId: string;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
  state: 'AI_PROPOSED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';
  readinessScore: number;
  evaluatedAt: string;
  reasonsToPursue: Array<{ title: string; detail: string; category: string; evidence?: unknown }>;
  reasonsNotToPursue: Array<{ title: string; detail: string; category: string; evidence?: unknown }>;
  hardDisqualifiers: Array<{ title: string; reason: string; clauseReference: string; shortfallDetail: string; evidence?: unknown }>;
  missingInformation: Array<{ title: string; missingFactor: string; suggestedAction: string; severity: string; deadlineDate?: string; evidence?: unknown }>;
  uncertainAreas: Array<{ clauseReference: string; ambiguityType: string; quote: string; recommendedClarification: string }>;
  commercialRisks: Array<{ title: string; severity: string; category: string; detail: string; mitigationAdvice: string }>;
  evidenceCitations: unknown[];
  reviewTriggers: unknown[];
}

/**
 * Maps the deterministic engine's wire response to the web's
 * `BidDecision` type. The engine uses GO/CONDITIONAL_GO/NO_GO/REVIEW_REQUIRED;
 * the web surfaces PURSUE/DO_NOT_PURSUE/REVIEW_REQUIRED.
 *
 * All reasons are flattened into a single evidence-backed string list.
 */
export function mapApiDecisionToBidDecision(
  api: ApiBidDecisionSummary,
): BidDecision {
  // GO → PURSUE, CONDITIONAL_GO → REVIEW_REQUIRED, NO_GO → DO_NOT_PURSUE, REVIEW_REQUIRED → REVIEW_REQUIRED
  const verdictMap: Record<ApiBidDecisionSummary['verdict'], BidRecommendation> = {
    GO: 'PURSUE',
    CONDITIONAL_GO: 'REVIEW_REQUIRED',
    NO_GO: 'DO_NOT_PURSUE',
    REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  };

  const allReasons: string[] = [
    ...api.reasonsToPursue.map((r) => `${r.title}: ${r.detail}`),
    ...api.reasonsNotToPursue.map((r) => `${r.title}: ${r.detail}`),
    ...api.hardDisqualifiers.map((d) => `${d.title}: ${d.reason} (${d.shortfallDetail})`),
    ...api.missingInformation.map((g) => `${g.title}: ${g.missingFactor} — ${g.suggestedAction}`),
    ...api.commercialRisks.map((r) => `${r.title}: ${r.detail} [${r.mitigationAdvice}]`),
  ];

  return {
    bidId: api.bidId,
    decisionId: api.decisionId,
    profileVersionId: api.profileVersionId,
    verdict: verdictMap[api.verdict] ?? 'REVIEW_REQUIRED',
    state: api.state,
    readinessScore: api.readinessScore,
    reasons: allReasons,
    reasonsToPursue: api.reasonsToPursue,
    reasonsNotToPursue: api.reasonsNotToPursue,
    hardDisqualifiers: api.hardDisqualifiers,
    missingInformation: api.missingInformation,
    uncertainAreas: api.uncertainAreas,
    commercialRisks: api.commercialRisks,
    evidenceCitations: api.evidenceCitations,
    reviewTriggers: api.reviewTriggers,
    evaluatedAt: api.evaluatedAt,
    evaluatedFactors:
      api.reasonsToPursue.length +
      api.reasonsNotToPursue.length +
      api.hardDisqualifiers.length +
      api.missingInformation.length +
      api.commercialRisks.length,
  };
}
