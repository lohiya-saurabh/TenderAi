/**
 * TenderPulse AI — Tender List Derivations
 *
 * Pure logic for the tender list table: responsive column visibility,
 * filtering, sorting, and client-side pagination.
 *
 * All inputs come from the existing API contract (BidSummary from
 * GET /api/v1/bids). The backend returns the full tenant list with no
 * query parameters, so search, filter, sort, and pagination are
 * computed in client memory. Server-side pagination
 * (GET /api/v1/bids?page=&limit=) is documented as a missing API in
 * MissingApiCallout.
 *
 * Everything here is pure and unit-tested — including the responsive
 * behavior (breakpoint → visible columns), which is testable as pure
 * logic even though the repo's vitest runs in a node environment
 * without a DOM.
 */

import type {
  BidDecisionState,
  BidDecisionSummary,
  BidSummary,
  BidVerdict,
} from '../../api/bids.js';
import { computeReadiness, computeRiskLevel, type DashboardRiskLevel } from '../../utils/readiness.js';
import { getDeadlineInfo } from '../../utils/deadline.js';
import { formatDate } from '../../utils/formatDate.js';

// Re-exported for dashboard consumers (single source of truth lives in utils/)
export { getDeadlineInfo };
export type { DeadlineInfo, DeadlineUrgency } from '../../utils/deadline.js';

// ---------------------------------------------------------------------------
// Responsive breakpoints
// ---------------------------------------------------------------------------

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

/** Map a viewport width to a breakpoint (mobile-first boundaries). */
export function getBreakpoint(width: number): Breakpoint {
  if (width >= 1280) return 'xl';
  if (width >= 1024) return 'lg';
  if (width >= 768) return 'md';
  return 'sm';
}

export type ColumnKey =
  | 'tender'
  | 'organization'
  | 'value'
  | 'deadline'
  | 'status'
  | 'fit'
  | 'recommendation'
  | 'risk'
  | 'readiness'
  | 'actions';

export const ALL_COLUMNS: ColumnKey[] = [
  'tender',
  'organization',
  'value',
  'deadline',
  'status',
  'fit',
  'recommendation',
  'risk',
  'readiness',
  'actions',
];

/**
 * Responsive column visibility — information density scales with width.
 * Fit & Recommendation hide first (they need horizontal room), then
 * Organization and Value, then Risk. Actions and the tender identity
 * column are always visible.
 */
export function getVisibleColumns(breakpoint: Breakpoint): ColumnKey[] {
  switch (breakpoint) {
    case 'xl':
      return ALL_COLUMNS;
    case 'lg':
      return ALL_COLUMNS.filter(
        (column) => column !== 'fit' && column !== 'recommendation',
      );
    case 'md':
      return ALL_COLUMNS.filter(
        (column) =>
          column !== 'fit' &&
          column !== 'recommendation' &&
          column !== 'organization' &&
          column !== 'value',
      );
    case 'sm':
    default:
      return ALL_COLUMNS.filter(
        (column) =>
          column !== 'fit' &&
          column !== 'recommendation' &&
          column !== 'organization' &&
          column !== 'value' &&
          column !== 'risk',
      );
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export type RiskFilter = 'ALL' | DashboardRiskLevel;

export interface TenderListFilters {
  search: string;
  /** 'ALL' or a BidSummary status */
  status: string;
  risk: RiskFilter;
}

export const DEFAULT_TENDER_LIST_FILTERS: TenderListFilters = {
  search: '',
  status: 'ALL',
  risk: 'ALL',
};

/**
 * Client-side filter: status tab, risk level, and free-text search
 * across title, tender number, and tendering authority.
 */
export function filterBids(
  bids: BidSummary[],
  filters: TenderListFilters,
): BidSummary[] {
  const search = filters.search.trim().toLowerCase();

  return bids.filter((bid) => {
    if (filters.status !== 'ALL' && bid.status !== filters.status) return false;
    if (filters.risk !== 'ALL' && computeRiskLevel(bid) !== filters.risk) {
      return false;
    }
    if (search.length > 0) {
      const haystack =
        `${bid.title} ${bid.tenderNumber} ${bid.tenderingAuthority}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/**
 * Human-readable descriptions of the active (non-default)
 * filters, for the no-match empty state. Pure so the empty
 * state copy is unit-testable.
 */
export function describeActiveFilters(
  filters: TenderListFilters,
): string[] {
  const descriptions: string[] = [];
  if (filters.status !== 'ALL') {
    descriptions.push(`status "${filters.status}"`);
  }
  if (filters.risk !== 'ALL') {
    descriptions.push(`risk "${filters.risk}"`);
  }
  if (filters.search.trim().length > 0) {
    descriptions.push(`search "${filters.search.trim()}"`);
  }
  return descriptions;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortKey =
  | 'title'
  | 'organization'
  | 'value'
  | 'deadline'
  | 'status'
  | 'risk'
  | 'readiness';

export type SortDirection = 'asc' | 'desc';

/** Maps a visible column to its sort key; undefined = not sortable. */
export const SORTABLE_COLUMNS: Partial<Record<ColumnKey, SortKey>> = {
  tender: 'title',
  organization: 'organization',
  value: 'value',
  deadline: 'deadline',
  status: 'status',
  risk: 'risk',
  readiness: 'readiness',
};

/** Sensible default direction when a new sort column is selected. */
export const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  title: 'asc',
  organization: 'asc',
  value: 'desc',
  deadline: 'asc',
  status: 'asc',
  risk: 'desc',
  readiness: 'desc',
};

/**
 * Workflow stage order for status sorting — the pipeline a
 * tender travels through, earliest first. Sorting by status
 * orders rows by pipeline position, not alphabetically.
 */
export const WORKFLOW_STAGE_ORDER: Record<BidSummary['status'], number> = {
  DRAFT: 0,
  ANALYZING: 1,
  REVIEW_READY: 2,
  SUBMITTED: 3,
  ARCHIVED: 4,
};

const RISK_SCORE: Record<DashboardRiskLevel, number> = {
  LOW: 0,
  HIGH: 1,
  CRITICAL: 2,
};

/** Nullable number comparison — missing values always sort last. */
function compareNullableNumbers(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function toEpochMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Total-order comparator for the tender list.
 * Null/missing values (no deadline, no value, no requirements yet)
 * always sort last regardless of direction.
 */
export function compareBids(
  a: BidSummary,
  b: BidSummary,
  key: SortKey,
  direction: SortDirection,
): number {
  switch (key) {
    case 'title':
      return direction === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    case 'organization':
      return direction === 'asc'
        ? a.tenderingAuthority.localeCompare(b.tenderingAuthority)
        : b.tenderingAuthority.localeCompare(a.tenderingAuthority);
    case 'value':
      return compareNullableNumbers(
        a.estimatedValueRupees ?? null,
        b.estimatedValueRupees ?? null,
        direction,
      );
    case 'deadline':
      return compareNullableNumbers(
        toEpochMs(a.submissionDeadline),
        toEpochMs(b.submissionDeadline),
        direction,
      );
    case 'status':
      return direction === 'asc'
        ? WORKFLOW_STAGE_ORDER[a.status] - WORKFLOW_STAGE_ORDER[b.status]
        : WORKFLOW_STAGE_ORDER[b.status] - WORKFLOW_STAGE_ORDER[a.status];
    case 'risk':
      return direction === 'asc'
        ? RISK_SCORE[computeRiskLevel(a)] - RISK_SCORE[computeRiskLevel(b)]
        : RISK_SCORE[computeRiskLevel(b)] - RISK_SCORE[computeRiskLevel(a)];
    case 'readiness':
      return compareNullableNumbers(
        computeReadiness(a).pct,
        computeReadiness(b).pct,
        direction,
      );
  }
}

// ---------------------------------------------------------------------------
// Deadline urgency — implemented in utils/deadline.ts (shared with the
// tender detail page) and re-exported above.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Deadline validity
// ---------------------------------------------------------------------------

/** True when a deadline string parses to a real date. */
export function isValidDeadline(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return !Number.isNaN(new Date(iso).getTime());
}

// ---------------------------------------------------------------------------
// Bid decision presentation (GET /api/v1/bids/:id/bid-decision)
// ---------------------------------------------------------------------------

export type FitTier = 'STRONG' | 'MODERATE' | 'WEAK';

/**
 * Fit tier from the engine's readinessScore (0.0–1.0).
 * Bands align with the engine's own boundaries: NO_GO scores
 * sit at/below 0.40, CONDITIONAL_GO starts at 0.45, and the
 * engine flags 0.50–0.70 as borderline. GO evaluates at 0.95.
 */
export function getFitTier(score: number): FitTier {
  if (score >= 0.7) return 'STRONG';
  if (score >= 0.45) return 'MODERATE';
  return 'WEAK';
}

/** readinessScore (0.0–1.0) as a display percentage. */
export function formatFitScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export type VerdictTone = 'success' | 'warning' | 'danger' | 'review';

/** Verdict → display label and tone (never color alone: the label carries the meaning). */
export function getVerdictVisual(verdict: BidVerdict): {
  label: string;
  tone: VerdictTone;
} {
  switch (verdict) {
    case 'GO':
      return { label: 'Go', tone: 'success' };
    case 'CONDITIONAL_GO':
      return { label: 'Conditional', tone: 'warning' };
    case 'NO_GO':
      return { label: 'No-Go', tone: 'danger' };
    case 'REVIEW_REQUIRED':
      return { label: 'Review', tone: 'review' };
  }
}

/** Human-in-the-loop state as a display label. */
export function getDecisionStateLabel(state: BidDecisionState): string {
  switch (state) {
    case 'AI_PROPOSED':
      return 'AI-proposed';
    case 'UNDER_REVIEW':
      return 'In review';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'OVERRIDDEN':
      return 'Overridden';
  }
}

/**
 * Tooltip text for the recommendation cell. AI-proposed verdicts
 * are never presented as final — the human-confirmation
 * requirement is stated explicitly.
 */
export function getDecisionTooltip(decision: BidDecisionSummary): string {
  const { label } = getVerdictVisual(decision.verdict);
  const confirmation =
    decision.state === 'CONFIRMED'
      ? 'Confirmed by human review.'
      : decision.state === 'OVERRIDDEN'
        ? 'Overridden by human review — the original engine verdict is preserved.'
        : decision.state === 'UNDER_REVIEW'
          ? 'Currently under human review.'
          : 'Proposed by the decision engine — human confirmation required.';
  return `${label}: ${confirmation} Fit score ${formatFitScore(decision.readinessScore)}. Evaluated ${formatDate(decision.evaluatedAt)}.`;
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

/** Contextual primary action label per workflow status. */
export function getRowActionLabel(status: BidSummary['status']): string {
  switch (status) {
    case 'REVIEW_READY':
      return 'Review';
    case 'DRAFT':
      return 'Continue';
    case 'ANALYZING':
      return 'Track';
    case 'SUBMITTED':
    case 'ARCHIVED':
    default:
      return 'View';
  }
}

// ---------------------------------------------------------------------------
// Client-side pagination
// ---------------------------------------------------------------------------

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalPages: number): number {
  const total = Math.max(1, totalPages);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), total);
}

export function getPageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, getTotalPages(items.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** 1-based inclusive range of the current page; { start: 0, end: 0 } when empty. */
export function getPaginationRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { start: number; end: number } {
  if (totalItems === 0) return { start: 0, end: 0 };
  const safePage = clampPage(page, getTotalPages(totalItems, pageSize));
  return {
    start: (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, totalItems),
  };
}

/**
 * Page number list with ellipsis, e.g. totalPages=9, current=5 →
 * [1, '…', 4, 5, 6, '…', 9]. Always shows first, last, and current ±1.
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) pages.push('ellipsis');
  for (let page = left; page <= right; page += 1) pages.push(page);
  if (right < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);

  return pages;
}
