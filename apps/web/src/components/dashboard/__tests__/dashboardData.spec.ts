import { describe, it, expect } from 'vitest';
import type { BidSummary } from '../../../api/bids.js';
import type { ComplianceItem } from '../../../api/compliance.js';
import {
  computeReadiness,
  computeRiskLevel,
  computePipelineStages,
  buildActionItems,
  daysUntil,
  DEADLINE_URGENT_WINDOW_MS,
} from '../dashboardData.js';

function makeBid(overrides: Partial<BidSummary> = {}): BidSummary {
  return {
    id: 'bid-1',
    title: 'Test Tender',
    tenderNumber: 'TST/2026/001',
    tenderingAuthority: 'Test Authority',
    estimatedValueRupees: 1000000,
    submissionDeadline: null,
    status: 'DRAFT',
    totalRequirements: 0,
    flaggedRequirements: 0,
    approvedRequirements: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeComplianceItem(overrides: Partial<ComplianceItem> = {}): ComplianceItem {
  return {
    id: 'ci-1',
    bidId: 'bid-1',
    category: 'FINANCIAL',
    requirement: 'Bid Security / EMD Guarantee of INR 5,00,000 via BG/FDR',
    isMandatory: true,
    status: 'PASS',
    companyEvidence: null,
    risk: null,
    rationale: null,
    humanReviewRequired: false,
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    version: 1,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: null,
    },
    provenance: {
      documentId: 'doc-1',
      documentName: 'NIT_Vol1.pdf',
      pageNumber: 12,
      sectionOrClause: 'ITB 3.1',
      verbatimQuote: 'The bidder shall deposit an earnest money deposit',
      confidenceScore: 0.98,
    },
    sourceCitation: {
      document: 'NIT_Vol1.pdf',
      page: 12,
      section: 'ITB 3.1',
      verbatimQuote: 'The bidder shall deposit an earnest money deposit',
      confidenceScore: 0.98,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeReadiness', () => {
  it('returns null pct when no requirements are extracted (pending intake, not 0%)', () => {
    const readiness = computeReadiness(makeBid({ totalRequirements: 0 }));
    expect(readiness.pct).toBeNull();
    expect(readiness.total).toBe(0);
  });

  it('computes approved/total percentage', () => {
    const readiness = computeReadiness(makeBid({ totalRequirements: 4, approvedRequirements: 3 }));
    expect(readiness.pct).toBe(75);
    expect(readiness.flagged).toBe(0);
  });
});

describe('computeRiskLevel', () => {
  it('LOW when no flags, HIGH for 1-2 flags, CRITICAL for 3+ (shared with TenderTableView)', () => {
    expect(computeRiskLevel(makeBid({ flaggedRequirements: 0 }))).toBe('LOW');
    expect(computeRiskLevel(makeBid({ flaggedRequirements: 1 }))).toBe('HIGH');
    expect(computeRiskLevel(makeBid({ flaggedRequirements: 2 }))).toBe('HIGH');
    expect(computeRiskLevel(makeBid({ flaggedRequirements: 3 }))).toBe('CRITICAL');
  });
});

describe('computePipelineStages', () => {
  it('counts bids per stage, aggregates readiness, and excludes ARCHIVED', () => {
    const bids = [
      makeBid({ id: 'a', status: 'DRAFT', totalRequirements: 0 }),
      makeBid({
        id: 'b',
        status: 'REVIEW_READY',
        totalRequirements: 4,
        approvedRequirements: 2,
        flaggedRequirements: 1,
      }),
      makeBid({ id: 'c', status: 'ARCHIVED' }),
    ];
    const stages = computePipelineStages(bids);

    const draft = stages.find((s) => s.status === 'DRAFT');
    const review = stages.find((s) => s.status === 'REVIEW_READY');

    expect(draft?.count).toBe(1);
    expect(draft?.readinessPct).toBeNull(); // no requirements yet
    expect(review?.count).toBe(1);
    expect(review?.readinessPct).toBe(50);
    expect(review?.flaggedRequirements).toBe(1);
    expect(stages.find((s) => s.status === 'SUBMITTED')?.count).toBe(0);
  });
});

describe('daysUntil', () => {
  it('computes whole days until a deadline and negative once closed', () => {
    const now = Date.parse('2026-10-05T00:00:00Z');
    expect(daysUntil('2026-10-08T00:00:00Z', now)).toBe(3);
    expect(daysUntil('2026-10-04T00:00:00Z', now)).toBeLessThan(0);
  });
});

describe('buildActionItems', () => {
  const NOW = Date.parse('2026-10-05T00:00:00Z');

  it('returns an empty list for empty input — no fabricated actions', () => {
    expect(buildActionItems([], {}, NOW)).toEqual([]);
  });

  it('surfaces FAIL or MISSING clauses as critical items deep-linked to the compliance review page', () => {
    const bids = [makeBid({ status: 'REVIEW_READY', flaggedRequirements: 1 })];
    const complianceByBid = {
      'bid-1': [makeComplianceItem({ status: 'FAIL', tenderClauseRef: 'ITB 3.1' })],
    };
    const items = buildActionItems(bids, complianceByBid, NOW);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('FLAGGED_REQUIREMENT');
    expect(items[0].urgency).toBe('critical');
    expect(items[0].headline).toBe(
      'Clause ITB 3.1: Bid Security / EMD Guarantee of INR 5,00,000 via BG/FDR',
    );
    expect(items[0].category).toBe('FINANCIAL');
    expect(items[0].actionUrl).toBe('/bids/bid-1/compliance/ci-1');
    expect(items[0].description).toContain('NIT_Vol1.pdf');
    expect(items[0].description).toContain('ITB 3.1');
  });

  it('surfaces clauses with REVIEW_REQUIRED status or humanReviewRequired as high-urgency review items', () => {
    const bids = [makeBid({ status: 'REVIEW_READY' })];
    const complianceByBid = {
      'bid-1': [makeComplianceItem({ humanReviewRequired: true })],
    };
    const items = buildActionItems(bids, complianceByBid, NOW);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('REVIEW_REQUIRED');
    expect(items[0].urgency).toBe('high');
  });

  it('ignores PASS clauses that do not require human review (low signal)', () => {
    const bids = [makeBid({ status: 'REVIEW_READY' })];
    const complianceByBid = {
      'bid-1': [makeComplianceItem({ status: 'PASS', humanReviewRequired: false })],
    };
    expect(buildActionItems(bids, complianceByBid, NOW)).toEqual([]);
  });

  it('reports ANALYZING bids as in-flight extraction (medium)', () => {
    const bids = [makeBid({ status: 'ANALYZING' })];
    const items = buildActionItems(bids, {}, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('EXTRACTION_IN_PROGRESS');
    expect(items[0].urgency).toBe('medium');
  });

  it('reports imminent deadlines inside the 7-day window, critical within 2 days', () => {
    const inFiveDays = new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString();
    const inOneDay = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    const inThirtyDays = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ id: 'far', submissionDeadline: inThirtyDays }),
      makeBid({ id: 'passed', submissionDeadline: yesterday }),
      makeBid({ id: 'soon', status: 'REVIEW_READY', submissionDeadline: inFiveDays }),
      makeBid({ id: 'urgent', status: 'REVIEW_READY', submissionDeadline: inOneDay }),
    ];
    const items = buildActionItems(bids, {}, NOW);

    const deadlineItems = items.filter((i) => i.type === 'IMMINENT_DEADLINE');
    expect(deadlineItems).toHaveLength(2);

    const urgent = deadlineItems.find((i) => i.bidId === 'urgent');
    const soon = deadlineItems.find((i) => i.bidId === 'soon');
    expect(urgent?.urgency).toBe('critical');
    expect(soon?.urgency).toBe('high');
  });

  it('reports DRAFT bids with zero extracted requirements as incomplete intake', () => {
    const bids = [makeBid({ status: 'DRAFT', totalRequirements: 0 })];
    const items = buildActionItems(bids, {}, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('DRAFT_INCOMPLETE');
    expect(items[0].urgency).toBe('medium');
  });

  it('excludes ARCHIVED bids from every signal', () => {
    const bids = [
      makeBid({
        status: 'ARCHIVED',
        flaggedRequirements: 5,
        submissionDeadline: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    const complianceByBid = {
      'bid-1': [makeComplianceItem({ status: 'FAIL' })],
    };
    expect(buildActionItems(bids, complianceByBid, NOW)).toEqual([]);
  });

  it('sorts by urgency (critical > high > medium), then by earliest deadline', () => {
    const inFiveDays = new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString();
    const inSixDays = new Date(NOW + 6 * 24 * 60 * 60 * 1000).toISOString();
    const bids = [
      makeBid({ id: 'draft', status: 'DRAFT', totalRequirements: 0 }),
      makeBid({ id: 'later', status: 'REVIEW_READY', submissionDeadline: inSixDays }),
      makeBid({ id: 'sooner', status: 'REVIEW_READY', submissionDeadline: inFiveDays }),
    ];
    const complianceByBid = {
      sooner: [makeComplianceItem({ id: 'ci-soon', status: 'FAIL' })],
    };

    const items = buildActionItems(bids, complianceByBid, NOW);
    const urgencies = items.map((i) => i.urgency);
    expect(urgencies.indexOf('critical')).toBeLessThan(urgencies.indexOf('high'));
    expect(urgencies.indexOf('high')).toBeLessThan(urgencies.indexOf('medium'));

    const deadlineItems = items.filter((i) => i.type === 'IMMINENT_DEADLINE');
    expect(deadlineItems[0].bidId).toBe('sooner');
  });

  it('never claims the 7-day window for a deadline exactly at the boundary', () => {
    const atBoundary = new Date(NOW + DEADLINE_URGENT_WINDOW_MS).toISOString();
    const bids = [makeBid({ status: 'REVIEW_READY', submissionDeadline: atBoundary })];
    expect(buildActionItems(bids, {}, NOW)).toEqual([]);
  });
});
