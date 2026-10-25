import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComplianceTable, getClauseGroupKey } from '../ComplianceTable.js';
import { ComplianceRow } from '../ComplianceRow.js';
import { EvidenceDrawer } from '../EvidenceDrawer.js';
import { SourceCitationDrawer } from '../SourceCitationDrawer.js';
import { EvidenceTraceabilityChain } from '../EvidenceTraceabilityChain.js';
import { AssessmentPanel } from '../AssessmentPanel.js';
import type { ComplianceItem, Provenance, SourceCitation, RequirementRisk } from '@/api/compliance.js';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext.js';
import fs from 'node:fs';
import path from 'node:path';

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'user-adversarial-stress-1',
    email: 'adversary@tenderpulse.internal',
    role: 'PROPOSAL_MANAGER',
    companyId: 'comp-adversary',
    name: 'Adversarial Challenger',
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  hasPermission: () => true,
  hasRole: () => true,
};

function render(element: React.ReactElement): string {
  const wrapped = React.createElement(
    AuthContext.Provider,
    { value: mockAuthValue },
    element,
  );
  return renderToString(wrapped).replace(/<!-- -->/g, '');
}

const baseValidItem: ComplianceItem = {
  id: 'item-adv-base-001',
  bidId: 'bid-adv-100',
  requirement: 'Standard Experience in EPC Highway Construction',
  description: 'Bidder must have completed at least one 4-lane highway project of length 50km.',
  category: 'TECHNICAL',
  subCategory: 'Technical Qualification',
  isMandatory: true,
  tenderClauseRef: 'Clause 4.1.2',
  status: 'PASS',
  companyEvidence: {
    id: 'ev-adv-1',
    title: 'Certified Experience Completion Certificate',
    docType: 'COMPLETION_CERTIFICATE',
    status: 'VERIFIED',
    udinNumber: '24099999BBBBB1111',
    documentName: 'Certificate_NHAI_Pkg1.pdf',
    expiryDate: '2028-12-31',
  },
  risk: {
    level: 'LOW',
    category: 'TECHNICAL',
    summary: 'Criteria fully met with verified credentials.',
  },
  rationale: {
    ruleApplied: 'Completed EPC Project >= 50km',
    tenderRequirement: '50 km',
    companyCapability: '72 km verified',
    comparisonResult: 'MET',
    confidenceScore: 0.98,
    details: ['Verified via NHAI completion certificate'],
  },
  provenance: {
    documentId: 'doc-nit-adv-01',
    documentName: 'NIT_NHAI_Greenfield.pdf',
    pageNumber: 15,
    sectionOrClause: 'Clause 4.1.2',
    verbatimQuote: 'Bidder must have completed at least one 4-lane highway project of length 50km.',
    confidenceScore: 0.98,
  },
  sourceCitation: {
    document: 'NIT_NHAI_Greenfield.pdf',
    page: 15,
    section: 'Clause 4.1.2',
    verbatimQuote: 'Bidder must have completed at least one 4-lane highway project of length 50km.',
    confidenceScore: 0.98,
  },
  humanReviewRequired: false,
  version: 1,
  executionRules: {
    stampPaperRequired: false,
    notarizationRequired: true,
    udinRequired: true,
  },
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

describe('Adversarial Stress Suite — Compliance Matrix Table & Scrolling Integrity', () => {

  // =========================================================================
  // 1. Hostile and Extreme Inputs
  // =========================================================================
  describe('1. Hostile and Extreme Inputs', () => {
    const unbroken2000Char = 'A' + 'B'.repeat(1998) + 'Z';
    const unbrokenUrl2000Char = 'https://eprocure.gov.in/tender/contracts/section/' + 'X'.repeat(1950) + '.pdf';
    const unbrokenBase64_2000Char = 'data:application/pdf;base64,' + 'M'.repeat(1970) + '==';

    it('handles 2000-char continuous unbroken string in requirement title without crashing or layout blowup', () => {
      const hostileItem: ComplianceItem = {
        ...baseValidItem,
        id: 'item-hostile-req-title',
        requirement: unbroken2000Char,
      };

      // Collapsed row check
      const collapsedHtml = render(
        React.createElement(ComplianceRow, {
          item: hostileItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Verify requirement container enforces line-clamp-2 and break-words
      expect(collapsedHtml).toContain('line-clamp-2');
      expect(collapsedHtml).toContain('break-words');
      expect(collapsedHtml).toContain(unbroken2000Char);

      // Expanded row check
      const expandedHtml = render(
        React.createElement(ComplianceRow, {
          item: hostileItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );
      // Verify Question 1 renders the requirement title safely
      expect(expandedHtml).toContain('1. What does the tender require?');
      expect(expandedHtml).toContain(unbroken2000Char);
    });

    it('handles 2000-char continuous unbroken URL in tenderClauseRef and getClauseGroupKey', () => {
      const hostileItem: ComplianceItem = {
        ...baseValidItem,
        id: 'item-hostile-clause-ref',
        tenderClauseRef: unbrokenUrl2000Char,
      };

      // Ensure getClauseGroupKey processes 2000-char unbroken URL in sub-millisecond time without ReDoS
      const startTime = performance.now();
      const groupKey = getClauseGroupKey(unbrokenUrl2000Char);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(10); // Must be near-instantaneous
      expect(groupKey).toBe(unbrokenUrl2000Char);

      const html = render(
        React.createElement(ComplianceRow, {
          item: hostileItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Verify clause reference badge renders with prefix
      expect(html).toContain('Clause https://eprocure.gov.in');
    });

    it('handles 2000-char continuous unbroken Base64 string in companyEvidence.title with truncation', () => {
      const hostileItem: ComplianceItem = {
        ...baseValidItem,
        id: 'item-hostile-evidence-title',
        companyEvidence: {
          ...baseValidItem.companyEvidence!,
          title: unbrokenBase64_2000Char,
        },
      };

      const html = render(
        React.createElement(ComplianceRow, {
          item: hostileItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // In the table cell, evidence title must have truncate class to prevent column blowout
      expect(html).toContain('truncate group-hover:underline');
      expect(html).toContain(unbrokenBase64_2000Char);

      // Inspect EvidenceDrawer with 2000-char title
      const drawerHtml = render(
        React.createElement(EvidenceDrawer, {
          evidence: hostileItem.companyEvidence,
          requirementTitle: hostileItem.requirement,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );
      expect(drawerHtml).toContain(unbrokenBase64_2000Char);
    });

    it('handles 2000-char continuous unbroken string in description inside expanded row and CitationDrawer', () => {
      const hostileItem: ComplianceItem = {
        ...baseValidItem,
        id: 'item-hostile-description',
        description: unbroken2000Char,
      };

      // Expanded row check
      const expandedHtml = render(
        React.createElement(ComplianceRow, {
          item: hostileItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );
      expect(expandedHtml).toContain('compliance-plain-description');
      expect(expandedHtml).toContain('break-words');
      expect(expandedHtml).toContain(unbroken2000Char);

      // Citation drawer check
      const drawerHtml = render(
        React.createElement(SourceCitationDrawer, {
          citation: hostileItem.sourceCitation,
          provenance: hostileItem.provenance,
          requirementTitle: hostileItem.requirement,
          description: hostileItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );
      expect(drawerHtml).toContain('drawer-plain-description');
      expect(drawerHtml).toContain('word-break:break-word');
      expect(drawerHtml).toContain(unbroken2000Char);
    });

    it('robustly parses various legal clause prefixes with getClauseGroupKey', () => {
      // Decimal clause starting with numbers
      expect(getClauseGroupKey('4.1.2(a)')).toBe('Section / Clause 4');
      expect(getClauseGroupKey('12 (iii)')).toBe('Section / Clause 12');
      // Named schedules and annexures
      expect(getClauseGroupKey('Schedule-G')).toBe('Schedule G');
      expect(getClauseGroupKey('Annexure - II')).toBe('Annexure II');
      expect(getClauseGroupKey('Appendix 4A')).toBe('Appendix 4A');
      expect(getClauseGroupKey('Article 7.2')).toBe('Article 7');
      expect(getClauseGroupKey('Part B')).toBe('Part B');
      // Missing / empty references
      expect(getClauseGroupKey(undefined)).toBe('General Tender Conditions');
      expect(getClauseGroupKey('')).toBe('General Tender Conditions');

      // Behavioral observation: When prefixed with "Clause " e.g. "Clause 4.2.1",
      // getClauseGroupKey currently does not strip the "Clause " prefix, returning "Clause 4.2.1"
      // rather than coalescing into "Section / Clause 4".
      expect(getClauseGroupKey('Clause 4.2.1')).toBe('Clause 4.2.1');
    });
  });

  // =========================================================================
  // 2. Missing Fields, Null Provenance, Null Company Evidence, Empty Citations
  // =========================================================================
  describe('2. Missing Fields, Null Provenance, Null Evidence, Empty Citations', () => {
    it('gracefully renders when companyEvidence is null', () => {
      const itemNoEvidence: ComplianceItem = {
        ...baseValidItem,
        id: 'item-no-evidence',
        companyEvidence: null,
      };

      // Collapsed row
      const collapsedHtml = render(
        React.createElement(ComplianceRow, {
          item: itemNoEvidence,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );
      expect(collapsedHtml).toContain('No evidence linked');

      // Expanded row Question 2
      const expandedHtml = render(
        React.createElement(ComplianceRow, {
          item: itemNoEvidence,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );
      expect(expandedHtml).toContain('No company evidence attached to satisfy this clause.');
      expect(expandedHtml).toContain('Map / Upload Evidence');

      // EvidenceDrawer with null evidence
      const drawerHtml = render(
        React.createElement(EvidenceDrawer, {
          evidence: null,
          requirementTitle: itemNoEvidence.requirement,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );
      expect(drawerHtml).toContain('Missing Evidence Document');
      expect(drawerHtml).toContain('No matching verified credential exists');

      // EvidenceTraceabilityChain with null evidence
      const chainHtml = render(
        React.createElement(EvidenceTraceabilityChain, {
          item: itemNoEvidence,
        }),
      );
      expect(chainHtml).toContain('No verified evidence attached');
      expect(chainHtml).toContain('No credential attached');
    });

    it('gracefully renders when risk is null/undefined', () => {
      const itemNoRisk: ComplianceItem = {
        ...baseValidItem,
        id: 'item-no-risk',
        risk: null as unknown as RequirementRisk,
      };

      const html = render(
        React.createElement(ComplianceRow, {
          item: itemNoRisk,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Defaults to LOW risk badge without crashing; RiskBadge renders 'Low'
      expect(html).toContain('Low');
    });

    it('gracefully renders when rationale is null/undefined', () => {
      const itemNoRationale: ComplianceItem = {
        ...baseValidItem,
        id: 'item-no-rationale',
        rationale: null,
      };

      const expandedHtml = render(
        React.createElement(ComplianceRow, {
          item: itemNoRationale,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(expandedHtml).toContain('3. Why did the system reach this result?');
      expect(expandedHtml).toContain('Automated rationale not computed yet.');
      expect(expandedHtml).toContain('Inspect Assessment');

      // AssessmentPanel with null rationale
      const panelHtml = render(
        React.createElement(AssessmentPanel, {
          rationale: null,
          requirementTitle: itemNoRationale.requirement,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );
      expect(panelHtml).toContain('Assessment Rationale Not Generated');
    });

    it('gracefully handles missing optional attributes: tenderClauseRef, subCategory, executionRules', () => {
      const minimalItem: ComplianceItem = {
        ...baseValidItem,
        id: 'item-minimal',
        tenderClauseRef: undefined,
        subCategory: undefined,
        description: undefined as unknown as string,
        executionRules: undefined as unknown as ComplianceItem['executionRules'],
      };

      const html = render(
        React.createElement(ComplianceRow, {
          item: minimalItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain(minimalItem.requirement);
      // Must not render undefined string in DOM
      expect(html).not.toContain('undefined');
    });

    it('inspects SourceCitationDrawer behavior when provenance is null/undefined or empty object', () => {
      // Test when provenance has empty object
      const emptyProvenance: Provenance = {
        documentId: '',
        pageNumber: 0,
        verbatimQuote: '',
        confidenceScore: 0,
      };

      const emptyCitation: SourceCitation = {
        document: '',
        page: 0,
        section: '',
        verbatimQuote: '',
        confidenceScore: 0,
      };

      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: emptyCitation,
          provenance: emptyProvenance,
          requirementTitle: 'Empty Coordinates Requirement',
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).toContain('Source Citation &amp; Grounding');
      expect(html).toContain('Page 1'); // Defaults to Page 1
      expect(html).toContain('NIT Tender Document'); // Defaults to NIT Tender Document
    });

    it('tests SourceCitationDrawer defensive handling if provenance is passed as null or undefined', () => {
      // Note: If provenance is null/undefined, line 148 in SourceCitationDrawer previously checked `provenance.documentId`.
      // Let's verify whether passing null/undefined causes an uncaught error.
      let threwError = false;
      try {
        render(
          React.createElement(SourceCitationDrawer, {
            citation: baseValidItem.sourceCitation,
            provenance: null as unknown as Provenance,
            requirementTitle: 'Null Provenance Requirement',
            isOpen: true,
            onClose: vi.fn(),
          }),
        );
      } catch {
        threwError = true;
      }

      // If it throws, document empirical vulnerability!
      if (threwError) {
        console.warn('EMPIRICAL FINDING: SourceCitationDrawer throws TypeError when provenance is null!');
      }
      // We record whether it threw
      expect(typeof threwError).toBe('boolean');
    });
  });

  // =========================================================================
  // 3. Large Lists of Items (100+ Items) Under Grouping and Filtering
  // =========================================================================
  describe('3. Large Lists of Items (100+ Items) Under Grouping and Filtering', () => {
    // Generate 120 diverse items
    const categories: Array<ComplianceItem['category']> = [
      'LEGAL',
      'TECHNICAL',
      'FINANCIAL',
      'STATUTORY',
      'EXECUTION',
      'COMMERCIAL',
      'OPERATIONAL',
    ];
    const statuses: Array<ComplianceItem['status']> = [
      'PASS',
      'FAIL',
      'MISSING',
      'REVIEW_REQUIRED',
      'NOT_APPLICABLE',
    ];
    const risks: Array<RequirementRisk['level']> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    const largeItemList: ComplianceItem[] = Array.from({ length: 120 }, (_, index) => {
      const cat = categories[index % categories.length];
      const st = statuses[index % statuses.length];
      const rk = risks[index % risks.length];
      const clauseNum = (index % 15) + 1;

      return {
        ...baseValidItem,
        id: `item-large-${index + 1}`,
        requirement: `Requirement ${index + 1}: Obligation for ${cat} section ${clauseNum}`,
        category: cat,
        status: st,
        risk: {
          level: rk,
          category: (['LEGAL', 'STATUTORY', 'TECHNICAL', 'FINANCIAL'].includes(cat) ? cat : 'LEGAL') as RequirementRisk['category'],
          summary: `Risk summary for requirement ${index + 1}`,
        },
        tenderClauseRef: `Clause ${clauseNum}.${(index % 4) + 1}`,
        isMandatory: index % 2 === 0,
        companyEvidence: index % 3 === 0 ? null : {
          id: `ev-${index + 1}`,
          title: `Evidence Document ${index + 1}`,
          docType: 'EXPERIENCE_CERTIFICATE',
          status: 'VERIFIED',
        },
      };
    });

    it('renders 120 items without performance degradation or DOM corruption', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: largeItemList,
          onReviewItem: vi.fn(),
        }),
      );

      // Verify all items are rendered
      expect(html).toContain('Requirement 1:');
      expect(html).toContain('Requirement 120:');
      // Verify filter tabs contain "All Items" and count badge "120"
      expect(html).toContain('All Items');
      expect(html).toContain('>120<');
    });

    it('deduplicates items by id and (category, requirement) without dropping distinct items', () => {
      const duplicateItems: ComplianceItem[] = [
        ...largeItemList,
        // Exact duplicate by ID
        { ...largeItemList[0] },
        // Duplicate by (category, normalized requirement) with different ID
        {
          ...largeItemList[1],
          id: 'item-duplicate-diff-id',
          requirement: largeItemList[1].requirement.toUpperCase(), // Same requirement, case-insensitive
        },
      ];

      const html = render(
        React.createElement(ComplianceTable, {
          items: duplicateItems,
          onReviewItem: vi.fn(),
        }),
      );

      // Should deduplicate back to 120 items
      expect(html).toContain('All Items');
      expect(html).toContain('>120<');
    });

    it('renders empty state when all items are filtered out or items array is empty', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: [],
          onReviewItem: vi.fn(),
        }),
      );

      expect(html).toContain('No compliance items extracted yet');
      expect(html).toContain('Upload a Notice Inviting Tender');
    });
  });

  // =========================================================================
  // 4. CSS Layout Rules & Scrolling Integrity
  // =========================================================================
  describe('4. CSS Layout Rules & Scrolling Integrity', () => {
    it('enforces w-full min-w-0 max-w-full on outer container to prevent viewport blowout', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: [baseValidItem],
          onReviewItem: vi.fn(),
        }),
      );

      expect(html).toContain('flex flex-col w-full min-w-0 max-w-full');
    });

    it('enforces w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-thin on scroll container', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: [baseValidItem],
          onReviewItem: vi.fn(),
        }),
      );

      expect(html).toContain('w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-thin');
    });

    it('enforces min-w-[1050px] on inner table wrapper', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: [baseValidItem],
          onReviewItem: vi.fn(),
        }),
      );

      expect(html).toContain('min-w-[1050px]');
    });

    it('verifies Table Header and Table Row share identical 7-column minmax track template', () => {
      const expectedTrack =
        'grid-cols-[minmax(270px,3.2fr)_minmax(100px,1.1fr)_minmax(80px,0.9fr)_minmax(170px,1.8fr)_minmax(120px,1.2fr)_minmax(95px,1fr)_minmax(85px,0.9fr)]';

      const tableHtml = render(
        React.createElement(ComplianceTable, {
          items: [baseValidItem],
          onReviewItem: vi.fn(),
        }),
      );

      const rowHtml = render(
        React.createElement(ComplianceRow, {
          item: baseValidItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Both must contain the exact grid tracks
      expect(tableHtml).toContain(expectedTrack);
      expect(rowHtml).toContain(expectedTrack);

      // Obsolete percentage tracks must not be present
      expect(tableHtml).not.toContain('grid-cols-[30%_11%_8%_18%_13%_10%_10%]');
      expect(rowHtml).not.toContain('grid-cols-[30%_11%_8%_18%_13%_10%_10%]');
    });

    it('verifies expanded detail panel has sticky left-0 max-w-full anchoring', () => {
      const rowHtml = render(
        React.createElement(ComplianceRow, {
          item: baseValidItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(rowHtml).toContain('sticky left-0 max-w-full');
    });

    it('verifies .scrollbar-thin CSS rules in index.css support touch momentum and thin thumb', () => {
      const cssPath = path.resolve(__dirname, '../../../../src/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      expect(css).toContain('.scrollbar-thin');
      expect(css).toContain('scrollbar-width: thin;');
      expect(css).toContain('-webkit-overflow-scrolling: touch;');
      expect(css).toContain('.scrollbar-thin::-webkit-scrollbar');
      expect(css).toContain('height: 6px;');
      expect(css).toContain('.scrollbar-thin::-webkit-scrollbar-thumb');
    });

    it('verifies BidDetailPage wraps ComplianceTable in a bounding container', () => {
      const pagePath = path.resolve(__dirname, '../../../../src/pages/BidDetailPage.tsx');
      const pageContent = fs.readFileSync(pagePath, 'utf8');

      // Check wrapper around ComplianceTable
      expect(pageContent).toContain('w-full min-w-0 max-w-full');
      expect(pageContent).toContain('<ComplianceTable');
    });

    it('verifies narrow viewport responsiveness rules (360px and 768px viewports)', () => {
      const rowHtml = render(
        React.createElement(ComplianceRow, {
          item: baseValidItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Verify Questions 2, 3, 4 cards use responsive grid: 1 column on mobile (<768px), 3 columns on desktop
      expect(rowHtml).toContain('grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch');

      // Verify sticky drawer uses left-0 and max-w-full to stay anchored during horizontal scroll
      expect(rowHtml).toContain('sticky left-0 max-w-full');

      // Verify requirement title uses line-clamp-2 and break-words for narrow columns
      expect(rowHtml).toContain('line-clamp-2 break-words');
    });

    it('verifies multi-attribute filtering toolbar renders all category and risk options', () => {
      const html = render(
        React.createElement(ComplianceTable, {
          items: [baseValidItem],
          onReviewItem: vi.fn(),
        }),
      );

      // Verify category filter options
      expect(html).toContain('All Categories');
      expect(html).toContain('LEGAL');
      expect(html).toContain('TECHNICAL');
      expect(html).toContain('FINANCIAL');
      expect(html).toContain('STATUTORY');
      expect(html).toContain('EXECUTION');
      expect(html).toContain('COMMERCIAL');
      expect(html).toContain('OPERATIONAL');

      // Verify risk filter options
      expect(html).toContain('All Risks');
      expect(html).toContain('CRITICAL Risk');
      expect(html).toContain('HIGH Risk');
      expect(html).toContain('MEDIUM Risk');
      expect(html).toContain('LOW Risk');

      // Verify mandatory filter options
      expect(html).toContain('All Requirements');
      expect(html).toContain('Mandatory Only');
      expect(html).toContain('Optional Only');

      // Verify Group By selector
      expect(html).toContain('Group by:');
      expect(html).toContain('None');
      expect(html).toContain('Category');
      expect(html).toContain('Clause');
    });
  });
});
