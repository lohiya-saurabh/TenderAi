/**
 * TenderPulse AI — Dashboard Derivations
 *
 * Pure functions that derive every dashboard insight exclusively from live
 * API payloads:
 *   - BidSummary[]        from GET /api/v1/bids
 *   - ComplianceItem[]    from GET /api/v1/bids/:id/compliance-items
 *
 * No fabricated data. Anything the backend does not expose yet (company
 * profile, expiring certificates, tender amendments) is documented as a
 * missing API in MissingApiCallout instead of being simulated here.
 */

import type { BidSummary } from '../../api/bids.js';
import type { ComplianceItem } from '../../api/compliance.js';
import { formatDate } from '../../utils/formatDate.js';
import { computeReadiness, computeRiskLevel } from '../../utils/readiness.js';

// Re-exported for dashboard consumers (single source of truth lives in utils/)
export { computeReadiness, computeRiskLevel };
export type { ReadinessSummary, DashboardRiskLevel } from '../../utils/readiness.js';

/** Submission-deadline urgency window used across dashboard sections. */
export const DEADLINE_URGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Bid Pipeline
// ---------------------------------------------------------------------------

/** Workflow stages shown in the pipeline funnel. ARCHIVED is terminal history, excluded. */
export const PIPELINE_STAGE_ORDER = [
  'DRAFT',
  'ANALYZING',
  'REVIEW_READY',
  'SUBMITTED',
] as const;

export type PipelineStageStatus = (typeof PIPELINE_STAGE_ORDER)[number];

const PIPELINE_STAGE_DESCRIPTIONS: Record<PipelineStageStatus, string> = {
  DRAFT: 'Tender intake — documents pending upload',
  ANALYZING: 'Extraction pipeline in-flight',
  REVIEW_READY: 'Awaiting human compliance review',
  SUBMITTED: 'Submitted to the procuring authority',
};

export interface PipelineStage {
  status: BidSummary['status'];
  label: string;
  description: string;
  count: number;
  totalRequirements: number;
  approvedRequirements: number;
  flaggedRequirements: number;
  /** Aggregate approved/total across the stage, or null when the stage has no requirements */
  readinessPct: number | null;
}

/** Roll up bids per workflow stage for the pipeline funnel. */
export function computePipelineStages(bids: BidSummary[]): PipelineStage[] {
  return PIPELINE_STAGE_ORDER.map((status) => {
    const stageBids = bids.filter((b) => b.status === status);
    const total = stageBids.reduce((sum, b) => sum + (b.totalRequirements || 0), 0);
    const approved = stageBids.reduce((sum, b) => sum + (b.approvedRequirements || 0), 0);
    const flagged = stageBids.reduce((sum, b) => sum + (b.flaggedRequirements || 0), 0);
    return {
      status,
      label: status.replace(/_/g, ' '),
      description: PIPELINE_STAGE_DESCRIPTIONS[status],
      count: stageBids.length,
      totalRequirements: total,
      approvedRequirements: approved,
      flaggedRequirements: flagged,
      readinessPct: total > 0 ? Math.round((approved / total) * 100) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Action Required
// ---------------------------------------------------------------------------

export type ActionItemType =
  | 'FLAGGED_REQUIREMENT'
  | 'REVIEW_REQUIRED'
  | 'EXTRACTION_IN_PROGRESS'
  | 'IMMINENT_DEADLINE'
  | 'DRAFT_INCOMPLETE';

export interface ActionItem {
  id: string;
  bidId: string;
  /** Compliance item ID when the action targets a specific clause */
  itemId?: string;
  bidTitle: string;
  tenderNumber: string;
  type: ActionItemType;
  headline: string;
  description: string;
  category?: ComplianceItem['category'];
  urgency: 'critical' | 'high' | 'medium';
  actionUrl: string;
  /** Deadline epoch ms for deadline-type items (secondary sort key) */
  deadlineMs?: number;
}

const URGENCY_SCORE = { critical: 3, high: 2, medium: 1 } as const;

function formatCategory(category: ComplianceItem['category']): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function provenanceSource(item: ComplianceItem): string {
  const p = item.provenance;
  if (!p || !p.documentName) return 'Grounded provenance pending';
  const clause = p.sectionOrClause ? ` · ${p.sectionOrClause}` : '';
  return `${p.documentName} · Page ${p.pageNumber}${clause}`;
}

/** Whole days until a deadline; negative once the window has closed. */
export function daysUntil(isoDeadline: string, nowMs: number): number {
  const deadlineMs = new Date(isoDeadline).getTime();
  return Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000));
}

/**
 * Build the merged, urgency-sorted action list from real data only:
 *   1. FLAGGED compliance clauses (missing evidence / disqualification risk)
 *   2. PENDING clauses explicitly marked humanReviewRequired
 *   3. Bids currently in the ANALYZING extraction pipeline
 *   4. Submission deadlines inside the 7-day urgency window
 *   5. DRAFT bids with zero extracted requirements (intake incomplete)
 *
 * Signals the backend does not expose yet (expiring certificates, tender
 * amendments) are NOT synthesized — they are documented as missing APIs.
 */
export function buildActionItems(
  bids: BidSummary[],
  complianceByBid: Record<string, ComplianceItem[]>,
  nowMs: number = Date.now(),
): ActionItem[] {
  const items: ActionItem[] = [];

  for (const bid of bids) {
    if (bid.status === 'ARCHIVED') continue;

    // 1–2. Clause-level signals from the compliance matrix
    for (const item of complianceByBid[bid.id] || []) {
      const source = provenanceSource(item);
      const headline = item.tenderClauseRef
        ? `Clause ${item.tenderClauseRef}: ${item.requirement}`
        : item.requirement;

      if (item.status === 'FAIL' || item.status === 'MISSING') {
        items.push({
          id: `flag-${bid.id}-${item.id}`,
          bidId: bid.id,
          itemId: item.id,
          bidTitle: bid.title,
          tenderNumber: bid.tenderNumber,
          type: 'FLAGGED_REQUIREMENT',
          headline,
          description: `${formatCategory(item.category)} clause ${item.status.toLowerCase()} — evidence missing or non-compliant. ${source}.`,
          category: item.category,
          urgency: 'critical',
          actionUrl: `/bids/${bid.id}/compliance/${item.id}`,
        });
      } else if (item.status === 'REVIEW_REQUIRED' || item.humanReviewRequired) {
        items.push({
          id: `review-${bid.id}-${item.id}`,
          bidId: bid.id,
          itemId: item.id,
          bidTitle: bid.title,
          tenderNumber: bid.tenderNumber,
          type: 'REVIEW_REQUIRED',
          headline,
          description: `${formatCategory(item.category)} clause awaiting human compliance review. ${source}.`,
          category: item.category,
          urgency: 'high',
          actionUrl: `/bids/${bid.id}/compliance/${item.id}`,
        });
      }
    }

    // 3. Extraction in-flight
    if (bid.status === 'ANALYZING') {
      items.push({
        id: `analyzing-${bid.id}`,
        bidId: bid.id,
        bidTitle: bid.title,
        tenderNumber: bid.tenderNumber,
        type: 'EXTRACTION_IN_PROGRESS',
        headline: 'AI extraction pipeline in-flight',
        description: 'Tender documents are processing through the asynchronous extraction worker.',
        urgency: 'medium',
        actionUrl: `/bids/${bid.id}`,
      });
    }

    // 4. Imminent submission deadline
    if (bid.submissionDeadline && bid.status !== 'SUBMITTED') {
      const deadlineMs = new Date(bid.submissionDeadline).getTime();
      const left = daysUntil(bid.submissionDeadline, nowMs);
      if (deadlineMs > nowMs && deadlineMs - nowMs < DEADLINE_URGENT_WINDOW_MS) {
        items.push({
          id: `deadline-${bid.id}`,
          bidId: bid.id,
          bidTitle: bid.title,
          tenderNumber: bid.tenderNumber,
          type: 'IMMINENT_DEADLINE',
          headline: `Submission deadline in ${left} day${left === 1 ? '' : 's'}`,
          description: `Due ${formatDate(bid.submissionDeadline)}. Finalize the compliance matrix and financial pack.`,
          urgency: left <= 2 ? 'critical' : 'high',
          actionUrl: `/bids/${bid.id}`,
          deadlineMs,
        });
      }
    }

    // 5. Draft with nothing extracted yet
    if (bid.status === 'DRAFT' && (bid.totalRequirements || 0) === 0) {
      items.push({
        id: `draft-${bid.id}`,
        bidId: bid.id,
        bidTitle: bid.title,
        tenderNumber: bid.tenderNumber,
        type: 'DRAFT_INCOMPLETE',
        headline: 'Tender intake incomplete',
        description: 'Upload the NIT and technical specifications to generate the requirement matrix.',
        urgency: 'medium',
        actionUrl: `/bids/${bid.id}`,
      });
    }
  }

  return items.sort((a, b) => {
    const byUrgency = URGENCY_SCORE[b.urgency] - URGENCY_SCORE[a.urgency];
    if (byUrgency !== 0) return byUrgency;
    if (a.deadlineMs && b.deadlineMs) return a.deadlineMs - b.deadlineMs;
    return 0;
  });
}
