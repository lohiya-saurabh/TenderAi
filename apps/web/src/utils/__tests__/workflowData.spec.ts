import { describe, it, expect } from 'vitest';
import type { BidDetail } from '../../api/bids.js';
import type { ComplianceItem } from '../../api/compliance.js';
import {
  WORKFLOW_STAGES,
  DEFAULT_COMPANY_PROFILE,
  deriveDeadlines,
  deriveEligibilityFactors,
  deriveBidDecision,
  deriveEvidenceCitations,
  deriveCommercialRisks,
  deriveMissingEvidence,
  deriveHumanReviewTask,
  deriveBidReadiness,
  deriveSubmissionChecklist,
} from '../workflowData.js';

describe('Workflow Domain Data & 13-Stage Journey', () => {
  const mockBid: BidDetail = {
    id: 'bid-test-001',
    title: 'Track Gauge Conversion and Civil Works',
    tenderNumber: 'WR-2026-ENG-4412',
    tenderingAuthority: 'Western Railway',
    estimatedValueRupees: 250000000, // 25 Cr
    submissionDeadline: '2026-11-20T15:00:00.000Z',
    status: 'REVIEW_READY',
    totalRequirements: 8,
    flaggedRequirements: 1,
    approvedRequirements: 7,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
    documents: [],
  };

  it('should define all 13 required business workflow stages in order', () => {
    expect(WORKFLOW_STAGES.length).toBe(13);
    const stageIds = WORKFLOW_STAGES.map((s) => s.id);
    expect(stageIds).toEqual([
      'company-profile',
      'tender-intake',
      'tender-overview',
      'key-deadlines',
      'eligibility-summary',
      'bid-decision',
      'requirement-matrix',
      'evidence-mapping',
      'commercial-risks',
      'missing-evidence',
      'human-review',
      'bid-readiness',
      'submission-prep',
    ]);
  });

  it('should provide complete persistent company capability profile with UDIN', () => {
    expect(DEFAULT_COMPANY_PROFILE.registrations.gstin).toBe('27AABCU9603R1ZM');
    expect(DEFAULT_COMPANY_PROFILE.registrations.pan).toBe('AABCU9603R');
    expect(DEFAULT_COMPANY_PROFILE.registrations.udyamNumber).toContain('UDYAM');
    expect(DEFAULT_COMPANY_PROFILE.isBlacklisted).toBe(false);

    // Verify 3-year turnover records have CA UDIN
    expect(DEFAULT_COMPANY_PROFILE.turnoverRecords.length).toBe(3);
    for (const record of DEFAULT_COMPANY_PROFILE.turnoverRecords) {
      expect(record.audited).toBe(true);
      expect(record.caUdin).toBeDefined();
      expect(record.caUdin?.length).toBeGreaterThan(10);
    }
  });

  it('should derive key deadlines and pre-bid meeting timelines', () => {
    const deadlines = deriveDeadlines(mockBid);
    expect(deadlines.length).toBe(4);

    const preBid = deadlines.find((d) => d.id === 'dl_pre_bid');
    expect(preBid).toBeDefined();
    expect(preBid?.description).toContain('Submit queries in writing');

    const subDue = deadlines.find((d) => d.id === 'dl_submission');
    expect(subDue).toBeDefined();
    expect(subDue?.date).toBeDefined();
  });

  it('should compute 9-factor eligibility scorecard against company capability', () => {
    const factors = deriveEligibilityFactors(mockBid, DEFAULT_COMPANY_PROFILE);
    expect(factors.length).toBe(9);

    const statutory = factors.find((f) => f.category === 'STATUTORY');
    expect(statutory?.status).toBe('PASSED');

    const turnover = factors.find((f) => f.category === 'FINANCIAL_TURNOVER');
    expect(turnover?.status).toBe('PASSED');
    expect(turnover?.explanation).toContain('Exceeds');

    const oem = factors.find((f) => f.category === 'OEM_AUTHORIZATION');
    expect(oem?.status).toBe('NEEDS_ATTENTION');
  });

  it('should generate bid/no-bid decision with plain-language reasons and action items', () => {
    const factors = deriveEligibilityFactors(mockBid, DEFAULT_COMPANY_PROFILE);
    const decision = deriveBidDecision(mockBid, factors);

    expect(decision.verdict).toBe('CONDITIONAL_GO');
    expect(decision.verdictLabel).toContain('CONDITIONAL GO');
    expect(decision.confidenceScore).toBeGreaterThanOrEqual(0.9);
    expect(decision.reasonsToPursue.length).toBeGreaterThan(0);
    expect(decision.reasonsNotToPursue.length).toBeGreaterThan(0);
    expect(decision.actionItems.length).toBeGreaterThan(0);
  });

  it('should produce dual-sided evidence citations mapping tender clauses to company proofs', () => {
    const mockComplianceItems: ComplianceItem[] = [
      {
        id: 'comp_01',
        bidId: mockBid.id,
        category: 'FINANCIAL',
        title: '3-Year Financial Turnover',
        description: 'Average turnover must exceed 50% of tender value.',
        status: 'READY',
        humanReviewRequired: false,
        version: 1,
        executionRules: {
          stampPaperRequired: false,
          notarizationRequired: false,
          udinRequired: true,
        },
        provenance: {
          documentId: 'doc_nit',
          documentName: 'NIT_Civil_Works.pdf',
          pageNumber: 12,
          sectionOrClause: 'Section III Clause 2.1',
          verbatimQuote: 'Average turnover of the tenderer must not be less than 50% of the advertised value.',
          confidenceScore: 0.98,
        },
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ];

    const citations = deriveEvidenceCitations(mockBid, mockComplianceItems, DEFAULT_COMPANY_PROFILE);
    expect(citations.length).toBe(1);
    expect(citations[0]?.tenderClauseRef).toBe('Section III Clause 2.1');
    expect(citations[0]?.companyEvidenceDocType).toBe('FINANCIAL_AUDIT');
    expect(citations[0]?.verificationStatus).toBe('VERIFIED');
    expect(citations[0]?.udinNumber).toBe('24089123AAAAA1234');
  });

  it('should identify commercial risks including LD caps and working capital lock-in', () => {
    const risks = deriveCommercialRisks();
    expect(risks.length).toBeGreaterThanOrEqual(3);

    const ldRisk = risks.find((r) => r.category === 'LIQUIDATED_DAMAGES');
    expect(ldRisk).toBeDefined();
    expect(ldRisk?.penaltySummary).toContain('10%');

    const wcRisk = risks.find((r) => r.category === 'WORKING_CAPITAL');
    expect(wcRisk).toBeDefined();
    expect(wcRisk?.financialImpactRupees).toBeGreaterThan(0);
  });

  it('should track missing evidence and turnaround times for contractor acquisition', () => {
    const missing = deriveMissingEvidence();
    expect(missing.length).toBeGreaterThan(0);

    for (const item of missing) {
      expect(item.issuingParty).toBeDefined();
      expect(item.estimatedTurnaroundDays).toBeGreaterThan(0);
      expect(item.actionNeeded).toBeDefined();
    }
  });

  it('should initialize human review task with OCC versioning and discussion thread', () => {
    const task = deriveHumanReviewTask();
    expect(task.version).toBe(1);
    expect(task.assignedRole).toBe('BID_MANAGER');
    expect(task.status).toBe('PENDING');
    expect(task.decisionState).toBe('AI_PROPOSED');
    expect(task.comments.length).toBe(2);
  });

  it('should calculate 4-pillar bid readiness score with clear sign-off criteria', () => {
    const readiness = deriveBidReadiness();
    expect(readiness.compositeScore).toBeGreaterThanOrEqual(80);
    expect(readiness.evidenceCompletenessPct).toBe(86);
    expect(readiness.riskClearancePct).toBe(80);
    expect(readiness.deadlinesBufferPct).toBe(90);
    expect(readiness.financialAffordabilityPct).toBe(85);
  });

  it('should construct Two-Cover submission checklist separating technical from financial BOQ', () => {
    const checklist = deriveSubmissionChecklist();
    const cover1 = checklist.filter((i) => i.cover === 'COVER_1_TECHNICAL');
    const cover2 = checklist.filter((i) => i.cover === 'COVER_2_FINANCIAL');

    expect(cover1.length).toBeGreaterThan(0);
    expect(cover2.length).toBeGreaterThan(0);

    const boqItem = cover2.find((i) => i.label.includes('BOQ'));
    expect(boqItem).toBeDefined();
    expect(boqItem?.notes).toContain('CRITICAL');
  });
});
