import { describe, it, expect } from 'vitest';
import type { BidSummary } from '../../../api/bids.js';
import {
  getBreakpoint,
  getVisibleColumns,
  ALL_COLUMNS,
  filterBids,
  compareBids,
  getDeadlineInfo,
  isValidDeadline,
  getRowActionLabel,
  getTotalPages,
  clampPage,
  getPageSlice,
  getPaginationRange,
  getPageNumbers,
  DEFAULT_SORT_DIRECTION,
  WORKFLOW_STAGE_ORDER,
  getFitTier,
  formatFitScore,
  getVerdictVisual,
  getDecisionStateLabel,
  getDecisionTooltip,
  describeActiveFilters,
  type TenderListFilters,
} from '../tenderListData.js';

function makeBid(overrides: Partial<BidSummary> = {}): BidSummary {
  return {
    id: 'bid-1',
    title: 'Four-laning of NH-44 Bypass Section',
    tenderNumber: 'NHAI/HQ/2026/EPC-4482',
    tenderingAuthority: 'National Highways Authority of India (NHAI)',
    estimatedValueRupees: 2450000000,
    submissionDeadline: '2026-11-15T15:00:00.000Z',
    status: 'REVIEW_READY',
    totalRequirements: 5,
    flaggedRequirements: 1,
    approvedRequirements: 2,
    createdAt: '2026-10-01T08:30:00.000Z',
    updatedAt: '2026-10-02T10:15:00.000Z',
    ...overrides,
  };
}

const DEFAULT_FILTERS: TenderListFilters = {
  search: '',
  status: 'ALL',
  risk: 'ALL',
};

// ---------------------------------------------------------------------------
// Responsive behavior
// ---------------------------------------------------------------------------

describe('getBreakpoint (responsive)', () => {
  it('maps viewport widths to breakpoints at exact boundaries', () => {
    expect(getBreakpoint(320)).toBe('sm');
    expect(getBreakpoint(767)).toBe('sm');
    expect(getBreakpoint(768)).toBe('md');
    expect(getBreakpoint(1023)).toBe('md');
    expect(getBreakpoint(1024)).toBe('lg');
    expect(getBreakpoint(1279)).toBe('lg');
    expect(getBreakpoint(1280)).toBe('xl');
    expect(getBreakpoint(2560)).toBe('xl');
  });
});

describe('getVisibleColumns (responsive column density)', () => {
  it('shows all columns on xl desktops', () => {
    expect(getVisibleColumns('xl')).toEqual(ALL_COLUMNS);
    expect(getVisibleColumns('xl')).toHaveLength(10);
  });

  it('hides Fit and Recommendation first on lg (not yet backed by an API)', () => {
    const columns = getVisibleColumns('lg');
    expect(columns).not.toContain('fit');
    expect(columns).not.toContain('recommendation');
    expect(columns).toContain('organization');
    expect(columns).toContain('value');
  });

  it('also hides Organization and Value on md tablets', () => {
    const columns = getVisibleColumns('md');
    expect(columns).toEqual([
      'tender',
      'deadline',
      'status',
      'risk',
      'readiness',
      'actions',
    ]);
  });

  it('keeps only the highest-density columns on sm phones', () => {
    const columns = getVisibleColumns('sm');
    expect(columns).toEqual(['tender', 'deadline', 'status', 'readiness', 'actions']);
  });

  it('always keeps the tender identity and actions columns at every breakpoint', () => {
    (['sm', 'md', 'lg', 'xl'] as const).forEach((breakpoint) => {
      const columns = getVisibleColumns(breakpoint);
      expect(columns[0]).toBe('tender');
      expect(columns[columns.length - 1]).toBe('actions');
    });
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('filterBids', () => {
  const bids = [
    makeBid({ id: 'a', title: 'NHAI Highway Project', status: 'REVIEW_READY', flaggedRequirements: 3 }),
    makeBid({ id: 'b', title: 'CPWD Office Complex', status: 'DRAFT', flaggedRequirements: 0, tenderingAuthority: 'CPWD', tenderNumber: 'CPWD/DELHI/2026/CIVIL-0491' }),
    makeBid({ id: 'c', title: 'Railway Electrification', status: 'ANALYZING', flaggedRequirements: 1, tenderingAuthority: 'Indian Railways', tenderNumber: 'IR/SE/2026/EL-001' }),
  ];

  it('returns everything for default filters', () => {
    expect(filterBids(bids, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it('filters by status tab', () => {
    expect(filterBids(bids, { ...DEFAULT_FILTERS, status: 'DRAFT' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, status: 'DRAFT' })[0].id).toBe('b');
  });

  it('filters by derived risk level (shared thresholds with the table)', () => {
    // 3 flags → CRITICAL, 1 flag → HIGH, 0 flags → LOW
    expect(filterBids(bids, { ...DEFAULT_FILTERS, risk: 'CRITICAL' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, risk: 'CRITICAL' })[0].id).toBe('a');
    expect(filterBids(bids, { ...DEFAULT_FILTERS, risk: 'HIGH' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, risk: 'LOW' })).toHaveLength(1);
  });

  it('searches across title, tender number, and authority (case-insensitive)', () => {
    expect(filterBids(bids, { ...DEFAULT_FILTERS, search: 'nhai' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, search: 'EPC-4482' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, search: 'cpwd' })).toHaveLength(1);
    expect(filterBids(bids, { ...DEFAULT_FILTERS, search: 'zzzz' })).toHaveLength(0);
  });

  it('combines status, risk, and search', () => {
    const result = filterBids(bids, {
      ...DEFAULT_FILTERS,
      status: 'REVIEW_READY',
      risk: 'CRITICAL',
      search: 'highway',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('compareBids', () => {
  it('sorts by title in both directions', () => {
    const a = makeBid({ title: 'Alpha Tender' });
    const b = makeBid({ title: 'Beta Tender' });
    expect(compareBids(a, b, 'title', 'asc')).toBeLessThan(0);
    expect(compareBids(a, b, 'title', 'desc')).toBeGreaterThan(0);
  });

  it('sorts by deadline with missing deadlines always last', () => {
    const withDate = makeBid({ submissionDeadline: '2026-11-15T00:00:00Z' });
    const noDate = makeBid({ submissionDeadline: null });
    expect(compareBids(withDate, noDate, 'deadline', 'asc')).toBeLessThan(0);
    // nulls stay last even in descending order
    expect(compareBids(withDate, noDate, 'deadline', 'desc')).toBeLessThan(0);
  });

  it('sorts by value with missing values last', () => {
    const high = makeBid({ estimatedValueRupees: 1000 });
    const low = makeBid({ estimatedValueRupees: 100 });
    const none = makeBid({ estimatedValueRupees: null });
    expect(compareBids(low, high, 'value', 'asc')).toBeLessThan(0);
    expect(compareBids(high, low, 'value', 'desc')).toBeLessThan(0);
    expect(compareBids(none, low, 'value', 'asc')).toBeGreaterThan(0);
    expect(compareBids(none, low, 'value', 'desc')).toBeGreaterThan(0);
  });

  it('sorts by risk severity', () => {
    const critical = makeBid({ flaggedRequirements: 3 });
    const high = makeBid({ flaggedRequirements: 1 });
    const low = makeBid({ flaggedRequirements: 0 });
    expect(compareBids(low, critical, 'risk', 'asc')).toBeLessThan(0);
    expect(compareBids(critical, low, 'risk', 'desc')).toBeLessThan(0);
    expect(compareBids(high, high, 'risk', 'asc')).toBe(0);
  });

  it('sorts by readiness, treating pending intake as last', () => {
    const ready = makeBid({ totalRequirements: 4, approvedRequirements: 4 }); // 100%
    const half = makeBid({ totalRequirements: 4, approvedRequirements: 2 }); // 50%
    const pending = makeBid({ totalRequirements: 0, approvedRequirements: 0 }); // null
    expect(compareBids(half, ready, 'readiness', 'asc')).toBeLessThan(0);
    expect(compareBids(ready, half, 'readiness', 'desc')).toBeLessThan(0);
    expect(compareBids(pending, half, 'readiness', 'asc')).toBeGreaterThan(0);
  });

  it('every sort key has a sensible default direction', () => {
    (['title', 'organization', 'value', 'deadline', 'risk', 'readiness'] as const).forEach(
      (key) => {
        expect(DEFAULT_SORT_DIRECTION[key]).toBeDefined();
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Deadline urgency
// ---------------------------------------------------------------------------

describe('getDeadlineInfo', () => {
  const NOW = Date.parse('2026-10-05T00:00:00Z');

  it('classifies urgency bands', () => {
    const inOneDay = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    const inFiveDays = new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString();
    const inThirtyDays = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();

    expect(getDeadlineInfo(inOneDay, NOW).urgency).toBe('urgent');
    expect(getDeadlineInfo(inFiveDays, NOW).urgency).toBe('soon');
    expect(getDeadlineInfo(inThirtyDays, NOW).urgency).toBe('normal');
    expect(getDeadlineInfo(yesterday, NOW).urgency).toBe('passed');
    expect(getDeadlineInfo(inFiveDays, NOW).daysLeft).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

describe('getRowActionLabel', () => {
  it('labels the primary action per workflow status', () => {
    expect(getRowActionLabel('REVIEW_READY')).toBe('Review');
    expect(getRowActionLabel('DRAFT')).toBe('Continue');
    expect(getRowActionLabel('ANALYZING')).toBe('Track');
    expect(getRowActionLabel('SUBMITTED')).toBe('View');
    expect(getRowActionLabel('ARCHIVED')).toBe('View');
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination helpers', () => {
  it('computes total pages', () => {
    expect(getTotalPages(0, 10)).toBe(1);
    expect(getTotalPages(10, 10)).toBe(1);
    expect(getTotalPages(11, 10)).toBe(2);
    expect(getTotalPages(95, 10)).toBe(10);
    expect(getTotalPages(5, 0)).toBe(1); // degenerate page size
  });

  it('clamps pages into the valid range', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(99, 5)).toBe(5);
    expect(clampPage(Number.NaN, 5)).toBe(1);
  });

  it('slices the correct page and tolerates out-of-range pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(getPageSlice(items, 1, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(getPageSlice(items, 3, 10)).toEqual([20, 21, 22, 23, 24]);
    expect(getPageSlice(items, 99, 10)).toEqual([20, 21, 22, 23, 24]);
    expect(getPageSlice([], 1, 10)).toEqual([]);
  });

  it('computes the 1-based visible range', () => {
    expect(getPaginationRange(1, 10, 25)).toEqual({ start: 1, end: 10 });
    expect(getPaginationRange(3, 10, 25)).toEqual({ start: 21, end: 25 });
    expect(getPaginationRange(1, 10, 0)).toEqual({ start: 0, end: 0 });
  });

  it('builds page numbers with ellipsis', () => {
    // Small totals: no ellipsis
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);

    // Middle page of a long list
    expect(getPageNumbers(5, 9)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 9]);

    // Near the start
    expect(getPageNumbers(2, 9)).toEqual([1, 2, 3, 'ellipsis', 9]);

    // Near the end
    expect(getPageNumbers(8, 9)).toEqual([1, 'ellipsis', 7, 8, 9]);

    // Always includes first and last
    const pages = getPageNumbers(50, 100);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(100);
    expect(pages).toContain(49);
    expect(pages).toContain(50);
    expect(pages).toContain(51);
  });
});

// ---------------------------------------------------------------------------
// Status sorting (workflow stage order)
// ---------------------------------------------------------------------------

describe('status sorting', () => {
  it('WORKFLOW_STAGE_ORDER maps each status to its pipeline position', () => {
    expect(WORKFLOW_STAGE_ORDER.DRAFT).toBe(0);
    expect(WORKFLOW_STAGE_ORDER.ANALYZING).toBe(1);
    expect(WORKFLOW_STAGE_ORDER.REVIEW_READY).toBe(2);
    expect(WORKFLOW_STAGE_ORDER.SUBMITTED).toBe(3);
    expect(WORKFLOW_STAGE_ORDER.ARCHIVED).toBe(4);
  });

  it('compareBids sorts by status using pipeline order (asc = earliest first)', () => {
    const draft = makeBid({ status: 'DRAFT' });
    const analyzing = makeBid({ status: 'ANALYZING' });
    const review = makeBid({ status: 'REVIEW_READY' });
    const submitted = makeBid({ status: 'SUBMITTED' });
    const archived = makeBid({ status: 'ARCHIVED' });

    expect(compareBids(analyzing, draft, 'status', 'asc')).toBeGreaterThan(0);
    expect(compareBids(draft, analyzing, 'status', 'asc')).toBeLessThan(0);
    expect(compareBids(submitted, review, 'status', 'asc')).toBeGreaterThan(0);
    expect(compareBids(archived, draft, 'status', 'asc')).toBeGreaterThan(0);
  });

  it('compareBids sorts by status descending (latest pipeline stage first)', () => {
    const draft = makeBid({ status: 'DRAFT' });
    const submitted = makeBid({ status: 'SUBMITTED' });
    expect(compareBids(draft, submitted, 'status', 'desc')).toBeGreaterThan(0);
    expect(compareBids(submitted, draft, 'status', 'desc')).toBeLessThan(0);
  });

  it('DEFAULT_SORT_DIRECTION includes status with sensible default', () => {
    expect(DEFAULT_SORT_DIRECTION.status).toBe('asc');
  });
});

// ---------------------------------------------------------------------------
// Deadline validity
// ---------------------------------------------------------------------------

describe('isValidDeadline', () => {
  it('returns false for null, undefined, and empty', () => {
    expect(isValidDeadline(null)).toBe(false);
    expect(isValidDeadline(undefined)).toBe(false);
    expect(isValidDeadline('')).toBe(false);
  });

  it('returns false for unparsable date strings', () => {
    expect(isValidDeadline('not-a-date')).toBe(false);
    expect(isValidDeadline('2026-13-45')).toBe(false);
  });

  it('returns true for valid ISO dates', () => {
    expect(isValidDeadline('2026-11-15T15:00:00.000Z')).toBe(true);
    expect(isValidDeadline('2026-10-05')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bid decision presentation
// ---------------------------------------------------------------------------

describe('getFitTier', () => {
  it('maps score boundaries to tiers (aligned with engine: NO_GO≤0.40, CONDITIONAL_GO≥0.45, borderline 0.50–0.70)', () => {
    expect(getFitTier(0.44)).toBe('WEAK');
    expect(getFitTier(0.45)).toBe('MODERATE');
    expect(getFitTier(0.69)).toBe('MODERATE');
    expect(getFitTier(0.70)).toBe('STRONG');
    expect(getFitTier(0.95)).toBe('STRONG');
    expect(getFitTier(0.0)).toBe('WEAK');
  });
});

describe('formatFitScore', () => {
  it('formats readinessScore (0.0–1.0) as percentage', () => {
    expect(formatFitScore(0)).toBe('0%');
    expect(formatFitScore(0.856)).toBe('86%');
    expect(formatFitScore(0.95)).toBe('95%');
    expect(formatFitScore(1.0)).toBe('100%');
  });
});

describe('getVerdictVisual', () => {
  it('returns correct label and tone for each verdict', () => {
    expect(getVerdictVisual('GO')).toEqual({ label: 'Go', tone: 'success' });
    expect(getVerdictVisual('CONDITIONAL_GO')).toEqual({ label: 'Conditional', tone: 'warning' });
    expect(getVerdictVisual('NO_GO')).toEqual({ label: 'No-Go', tone: 'danger' });
    expect(getVerdictVisual('REVIEW_REQUIRED')).toEqual({ label: 'Review', tone: 'review' });
  });
});

describe('getDecisionStateLabel', () => {
  it('returns human-readable label for each state', () => {
    expect(getDecisionStateLabel('AI_PROPOSED')).toBe('AI-proposed');
    expect(getDecisionStateLabel('UNDER_REVIEW')).toBe('In review');
    expect(getDecisionStateLabel('CONFIRMED')).toBe('Confirmed');
    expect(getDecisionStateLabel('OVERRIDDEN')).toBe('Overridden');
  });
});

describe('getDecisionTooltip', () => {
  const mockDecision = {
    decisionId: 'dec-1',
    bidId: 'bid-1',
    profileVersionId: 'pv-1',
    verdict: 'GO' as const,
    state: 'AI_PROPOSED' as const,
    readinessScore: 0.85,
    evaluatedAt: '2026-10-05T10:00:00.000Z',
    reasonsToPursue: [],
    reasonsNotToPursue: [],
    hardDisqualifiers: [],
    missingInformation: [],
    uncertainAreas: [],
    commercialRisks: [],
    evidenceCitations: [],
    reviewTriggers: [],
  };

  it('includes verdict label, fit score, evaluation date, and confirmation requirement for AI_PROPOSED', () => {
    const tip = getDecisionTooltip(mockDecision);
    expect(tip).toContain('Go');
    expect(tip).toContain('85%');
    expect(tip).toContain('05 Oct 2026');
    expect(tip).toContain('human confirmation required');
  });

  it('shows Confirmed when state is CONFIRMED', () => {
    const confirmed = { ...mockDecision, state: 'CONFIRMED' as const };
    expect(getDecisionTooltip(confirmed)).toContain('Confirmed by human review');
  });

  it('shows Overridden when state is OVERRIDDEN', () => {
    const overridden = { ...mockDecision, state: 'OVERRIDDEN' as const };
    expect(getDecisionTooltip(overridden)).toContain('Overridden by human review');
  });
});

// ---------------------------------------------------------------------------
// Active filter descriptions
// ---------------------------------------------------------------------------

describe('describeActiveFilters', () => {
  const baseFilters: TenderListFilters = { search: '', status: 'ALL', risk: 'ALL' };

  it('returns empty array for default filters', () => {
    expect(describeActiveFilters(baseFilters)).toEqual([]);
  });

  it('describes non-default status', () => {
    expect(describeActiveFilters({ ...baseFilters, status: 'DRAFT' })).toEqual(['status "DRAFT"']);
  });

  it('describes non-default risk', () => {
    expect(describeActiveFilters({ ...baseFilters, risk: 'HIGH' })).toEqual(['risk "HIGH"']);
  });

  it('describes search term', () => {
    expect(describeActiveFilters({ ...baseFilters, search: 'nhai' })).toEqual(['search "nhai"']);
  });

  it('combines multiple active filters', () => {
    const desc = describeActiveFilters({ search: 'highway', status: 'REVIEW_READY', risk: 'CRITICAL' });
    expect(desc).toContain('search "highway"');
    expect(desc).toContain('status "REVIEW_READY"');
    expect(desc).toContain('risk "CRITICAL"');
  });
});
