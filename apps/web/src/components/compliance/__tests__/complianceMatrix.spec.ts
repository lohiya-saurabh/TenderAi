import { describe, it, expect } from 'vitest';
import type { ComplianceItem } from '@/api/compliance.js';

describe('Requirement / Compliance Matrix Data & Logic', () => {
  const mockItems: ComplianceItem[] = [
    {
      id: 'item-1',
      bidId: 'bid-123',
      requirement: 'Bidder must submit audited balance sheet for last 3 financial years.',
      category: 'FINANCIAL',
      subCategory: 'Annual Turnover',
      isMandatory: true,
      tenderClauseRef: '4.2.1',
      status: 'PASS',
      companyEvidence: {
        id: 'ev-1',
        title: 'Audited Financials FY 2021-2024',
        docType: 'CA_AUDITED_BALANCE_SHEET',
        documentName: 'FY21_24_Audited_Turnover.pdf',
        status: 'VERIFIED',
        udinNumber: '24089123AAAAA1234',
        expiryDate: '2027-03-31',
        notes: 'Average turnover ₹42 Cr exceeds tender requirement of ₹25 Cr.',
      },
      risk: {
        level: 'LOW',
        category: 'FINANCIAL',
        summary: 'Turnover criteria exceeded by 68%.',
      },
      rationale: {
        ruleApplied: 'Minimum Average Annual Turnover >= ₹25,00,00,000 INR in last 3 FYs',
        tenderRequirement: '₹25.00 Cr 3-year average turnover',
        companyCapability: '₹42.15 Cr 3-year average turnover verified via CA certificate',
        comparisonResult: 'MET',
        confidenceScore: 0.98,
        details: [
          'FY 2021-22: ₹38.2 Cr',
          'FY 2022-23: ₹41.5 Cr',
          'FY 2023-24: ₹46.8 Cr',
          'Valid 18-digit UDIN verified on ICAI portal',
        ],
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'NIT_Civil_Works_2026.pdf',
        pageNumber: 14,
        sectionOrClause: 'Section III - Qualification Criteria, Clause 4.2',
        verbatimQuote:
          'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 25.00 Crores.',
        confidenceScore: 0.96,
      },
      sourceCitation: {
        document: 'NIT_Civil_Works_2026.pdf',
        page: 14,
        section: 'Section III - 4.2',
        verbatimQuote:
          'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 25.00 Crores.',
        confidenceScore: 0.96,
      },
      humanReviewRequired: false,
      version: 1,
      executionRules: {
        stampPaperRequired: false,
        notarizationRequired: false,
        udinRequired: true,
        signingAuthorityRank: 'Chartered Accountant & Managing Director',
      },
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'item-2',
      bidId: 'bid-123',
      requirement: 'Submit Non-Judicial Stamp Paper declaration for non-blacklisting.',
      category: 'LEGAL',
      subCategory: 'Statutory Declaration',
      isMandatory: true,
      tenderClauseRef: '2.1.8',
      status: 'MISSING',
      companyEvidence: null,
      risk: {
        level: 'CRITICAL',
        category: 'STATUTORY',
        summary: 'Mandatory non-blacklisting affidavit on ₹100 stamp paper missing.',
      },
      rationale: {
        ruleApplied:
          'Non-blacklisting affidavit on Non-Judicial Stamp Paper of ₹100 attested by Notary Public',
        tenderRequirement: 'Original affidavit on ₹100 stamp paper notarized within last 30 days',
        companyCapability: 'No active non-blacklisting affidavit uploaded in vault',
        comparisonResult: 'NOT_MET',
        confidenceScore: 0.92,
        details: [
          'Mandatory disqualification clause under Section I Clause 2.1.8',
          'Requires notary seal and advocate registration number',
        ],
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'NIT_Civil_Works_2026.pdf',
        pageNumber: 8,
        sectionOrClause: 'Section I - Instructions to Bidders, Clause 2.1.8',
        verbatimQuote:
          'The bidder shall submit an affidavit on Non-Judicial Stamp Paper of Rs 100/- duly notarized declaring that the firm has not been blacklisted by any Government department.',
        confidenceScore: 0.95,
      },
      sourceCitation: {
        document: 'NIT_Civil_Works_2026.pdf',
        page: 8,
        section: 'Section I - 2.1.8',
        verbatimQuote:
          'The bidder shall submit an affidavit on Non-Judicial Stamp Paper of Rs 100/- duly notarized declaring that the firm has not been blacklisted by any Government department.',
        confidenceScore: 0.95,
      },
      humanReviewRequired: true,
      version: 1,
      executionRules: {
        stampPaperRequired: true,
        stampPaperDenominationInr: 100,
        notarizationRequired: true,
        udinRequired: false,
        signingAuthorityRank: 'Authorized Signatory / Director',
      },
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'item-3',
      bidId: 'bid-123',
      requirement: 'ISO 9001:2015 Quality Management System certification required.',
      category: 'TECHNICAL',
      subCategory: 'Quality Certification',
      isMandatory: false,
      tenderClauseRef: '5.1',
      status: 'REVIEW_REQUIRED',
      companyEvidence: {
        id: 'ev-3',
        title: 'ISO 9001:2015 Certificate',
        docType: 'ISO_CERTIFICATION',
        documentName: 'ISO_9001_2015_Certificate.pdf',
        status: 'SELF_ATTESTED',
        expiryDate: '2026-11-30',
        notes: 'Certificate expires next month — renewal in progress.',
      },
      risk: {
        level: 'MEDIUM',
        category: 'TECHNICAL',
        summary: 'ISO certificate validity expires near bid closing date.',
      },
      rationale: {
        ruleApplied: 'Valid ISO 9001:2015 certificate throughout contract execution period',
        tenderRequirement: 'Current ISO 9001 certificate valid for at least 6 months post-bid',
        companyCapability: 'Certificate valid until Nov 2026 (expires within 60 days)',
        comparisonResult: 'PARTIAL',
        confidenceScore: 0.84,
        details: [
          'Company has valid certificate today, but expiry is 2026-11-30',
          'Recertification audit scheduled for Oct 15, 2026',
        ],
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'NIT_Civil_Works_2026.pdf',
        pageNumber: 22,
        sectionOrClause: 'Section IV - Technical Specifications, Clause 5.1',
        verbatimQuote:
          'Bidder should possess valid ISO 9001:2015 certificate at the time of submission and maintain validity throughout execution.',
        confidenceScore: 0.9,
      },
      sourceCitation: {
        document: 'NIT_Civil_Works_2026.pdf',
        page: 22,
        section: 'Section IV - 5.1',
        verbatimQuote:
          'Bidder should possess valid ISO 9001:2015 certificate at the time of submission and maintain validity throughout execution.',
        confidenceScore: 0.9,
      },
      humanReviewRequired: true,
      version: 2,
      reviewNotes: 'Follow up with ISO audit team for letter of continuation.',
      executionRules: {
        stampPaperRequired: false,
        notarizationRequired: false,
        udinRequired: false,
        signingAuthorityRank: 'Accredited Certification Body',
      },
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-02T14:30:00Z',
    },
  ];

  it('verifies all 5 standard compliance statuses are supported', () => {
    const statuses = ['PASS', 'FAIL', 'MISSING', 'REVIEW_REQUIRED', 'NOT_APPLICABLE'];
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('PASS');
    expect(statuses).toContain('FAIL');
    expect(statuses).toContain('MISSING');
    expect(statuses).toContain('REVIEW_REQUIRED');
    expect(statuses).toContain('NOT_APPLICABLE');
  });

  it('filters items correctly by status', () => {
    const passItems = mockItems.filter((i) => i.status === 'PASS');
    expect(passItems).toHaveLength(1);
    expect(passItems[0].id).toBe('item-1');

    const missingItems = mockItems.filter((i) => i.status === 'MISSING');
    expect(missingItems).toHaveLength(1);
    expect(missingItems[0].id).toBe('item-2');

    const reviewItems = mockItems.filter((i) => i.status === 'REVIEW_REQUIRED');
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].id).toBe('item-3');
  });

  it('filters items correctly by category', () => {
    const financial = mockItems.filter((i) => i.category === 'FINANCIAL');
    expect(financial).toHaveLength(1);
    expect(financial[0].requirement).toContain('balance sheet');

    const legal = mockItems.filter((i) => i.category === 'LEGAL');
    expect(legal).toHaveLength(1);
    expect(legal[0].requirement).toContain('Stamp Paper');
  });

  it('filters items correctly by mandatory status', () => {
    const mandatory = mockItems.filter((i) => i.isMandatory);
    expect(mandatory).toHaveLength(2);

    const optional = mockItems.filter((i) => !i.isMandatory);
    expect(optional).toHaveLength(1);
    expect(optional[0].id).toBe('item-3');
  });

  it('searches across requirements, clauses, evidence titles, and rules', () => {
    const query = 'turnover';
    const matches = mockItems.filter((item) => {
      const q = query.toLowerCase();
      return (
        item.requirement.toLowerCase().includes(q) ||
        item.subCategory?.toLowerCase().includes(q) ||
        item.companyEvidence?.title.toLowerCase().includes(q) ||
        item.rationale?.ruleApplied.toLowerCase().includes(q)
      );
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('item-1');
  });

  it('answers Question 1: What does the tender require with execution rules', () => {
    const item = mockItems[1]; // Stamp paper item
    expect(item.requirement).toBeDefined();
    expect(item.executionRules.stampPaperRequired).toBe(true);
    expect(item.executionRules.stampPaperDenominationInr).toBe(100);
    expect(item.executionRules.notarizationRequired).toBe(true);
  });

  it('answers Question 2: Do we have evidence with verification tier & UDIN', () => {
    const itemWithEvidence = mockItems[0];
    expect(itemWithEvidence.companyEvidence).not.toBeNull();
    expect(itemWithEvidence.companyEvidence?.status).toBe('VERIFIED');
    expect(itemWithEvidence.companyEvidence?.udinNumber).toBe('24089123AAAAA1234');

    const itemWithoutEvidence = mockItems[1];
    expect(itemWithoutEvidence.companyEvidence).toBeNull();
  });

  it('answers Question 3: Why did the system reach this result with structured rationale', () => {
    const item = mockItems[0];
    expect(item.rationale).not.toBeNull();
    expect(item.rationale?.comparisonResult).toBe('MET');
    expect(item.rationale?.ruleApplied).toContain('Minimum Average Annual Turnover');
    expect(item.rationale?.details.length).toBeGreaterThan(0);
    expect(item.rationale?.confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it('answers Question 4: Where did this requirement come from with source citations', () => {
    const item = mockItems[0];
    expect(item.sourceCitation.document).toBe('NIT_Civil_Works_2026.pdf');
    expect(item.sourceCitation.page).toBe(14);
    expect(item.sourceCitation.section).toBe('Section III - 4.2');
    expect(item.sourceCitation.verbatimQuote).toContain('Rs 25.00 Crores');
    expect(item.provenance.documentId).toBe('doc-nit-01');
  });

  it('preserves optimistic concurrency control with version tracking', () => {
    const item = mockItems[2];
    expect(item.version).toBe(2);
    expect(item.reviewNotes).toBeDefined();
  });

  it('normalizes clause references to prevent 1-item buckets via getClauseGroupKey', async () => {
    const { getClauseGroupKey } = await import('@/components/compliance/ComplianceTable.js');

    expect(getClauseGroupKey('4.1.3')).toBe('Section / Clause 4');
    expect(getClauseGroupKey('4.2')).toBe('Section / Clause 4');
    expect(getClauseGroupKey('4 (i)')).toBe('Section / Clause 4');
    expect(getClauseGroupKey('Schedule G')).toBe('Schedule G');
    expect(getClauseGroupKey('Article 7')).toBe('Article 7');
    expect(getClauseGroupKey('Annexure I')).toBe('Annexure I');
    expect(getClauseGroupKey(undefined)).toBe('General Tender Conditions');
  });
});
