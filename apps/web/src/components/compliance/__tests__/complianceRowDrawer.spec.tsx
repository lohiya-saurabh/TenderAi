import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComplianceRow } from '../ComplianceRow.js';
import { SourceCitationDrawer } from '../SourceCitationDrawer.js';
import type { ComplianceItem } from '@/api/compliance.js';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext.js';

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'user-1',
    email: 'lead@tenderpulse.internal',
    role: 'PROPOSAL_MANAGER',
    companyId: 'comp-1',
    name: 'Bid Lead',
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

const mockItem: ComplianceItem = {
  id: 'item-101',
  bidId: 'bid-999',
  requirement: 'Minimum Average Annual Turnover',
  description:
    'The bidder must demonstrate average annual turnover of at least ₹50 Crore in the last 3 financial years certified by a CA.',
  category: 'FINANCIAL',
  subCategory: 'Annual Turnover',
  isMandatory: true,
  tenderClauseRef: '4.2',
  status: 'PASS',
  companyEvidence: {
    id: 'ev-1',
    title: 'Audited Financials FY 2021-2024',
    docType: 'CA_AUDITED_BALANCE_SHEET',
    status: 'VERIFIED',
    udinNumber: '24089123AAAAA1234',
  },
  risk: {
    level: 'LOW',
    category: 'FINANCIAL',
    summary: 'Turnover exceeds threshold.',
  },
  rationale: {
    ruleApplied: 'Turnover >= ₹50 Cr',
    tenderRequirement: '₹50 Cr',
    companyCapability: '₹75 Cr verified',
    comparisonResult: 'MET',
    confidenceScore: 0.98,
    details: ['Verified via UDIN'],
  },
  provenance: {
    documentId: 'doc-nit-01',
    documentName: 'NIT_Baswantpur.pdf',
    pageNumber: 14,
    sectionOrClause: 'Clause 4.2',
    verbatimQuote:
      'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 50.00 Crores.',
    confidenceScore: 0.96,
  },
  sourceCitation: {
    document: 'NIT_Baswantpur.pdf',
    page: 14,
    section: 'Clause 4.2',
    verbatimQuote:
      'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 50.00 Crores.',
    confidenceScore: 0.96,
  },
  humanReviewRequired: false,
  version: 1,
  executionRules: {
    stampPaperRequired: false,
    notarizationRequired: false,
    udinRequired: true,
    signingAuthorityRank: 'Managing Director',
  },
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

describe('ComplianceRow & SourceCitationDrawer R1 Requirements', () => {
  describe('ComplianceRow Description Concealment & Expanded Reveal', () => {
    it('conceals inline description text in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: mockItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Requirement title and metadata badges MUST remain visible
      expect(html).toContain('Minimum Average Annual Turnover');
      expect(html).toContain('Clause 4.2');
      expect(html).toContain('FINANCIAL');
      expect(html).toContain('Mandatory');
      expect(html).toContain('p.14');

      // Inline description text MUST NOT be rendered in the collapsed row
      expect(html).not.toContain(
        'The bidder must demonstrate average annual turnover of at least ₹50 Crore in the last 3 financial years certified by a CA.',
      );
      expect(html).not.toContain('compliance-plain-description');
    });

    it('reveals full plain-language description inside Question 1 card when expanded', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: mockItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Question 1 header and plain-language description container
      expect(html).toContain('1. What does the tender require?');
      expect(html).toContain('Plain-Language Description');
      expect(html).toContain(
        'The bidder must demonstrate average annual turnover of at least ₹50 Crore in the last 3 financial years certified by a CA.',
      );
      expect(html).toContain('compliance-plain-description');
      expect(html).toContain('Mandatory Qualification Criterion');
    });

    it('gracefully handles missing description when expanded without empty description block', () => {
      const itemWithoutDesc: ComplianceItem = {
        ...mockItem,
        description: undefined,
      };

      const html = render(
        React.createElement(ComplianceRow, {
          item: itemWithoutDesc,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('1. What does the tender require?');
      expect(html).toContain('Minimum Average Annual Turnover');
      expect(html).not.toContain('compliance-plain-description');
      expect(html).not.toContain('Plain-Language Description');
    });
  });

  describe('SourceCitationDrawer Description Display', () => {
    it('renders plain-language description alongside verbatim quote in SourceCitationDrawer when open', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: mockItem.sourceCitation,
          provenance: mockItem.provenance,
          requirementTitle: mockItem.requirement,
          description: mockItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      // Header and Source coordinates
      expect(html).toContain('Source Citation &amp; Grounding');
      expect(html).toContain('NIT_Baswantpur.pdf');
      expect(html).toContain('Page 14');
      expect(html).toContain('Clause 4.2');

      // Dedicated Plain-Language Requirement Description Card
      expect(html).toContain('drawer-plain-description');
      expect(html).toContain('Plain-Language Requirement Description');
      expect(html).toContain(
        'The bidder must demonstrate average annual turnover of at least ₹50 Crore in the last 3 financial years certified by a CA.',
      );

      // Verbatim Quote Card
      expect(html).toContain('Verbatim Tender Clause');
      expect(html).toContain(
        'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 50.00 Crores.',
      );
    });

    it('omits plain-language description card when description is not provided', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: mockItem.sourceCitation,
          provenance: mockItem.provenance,
          requirementTitle: mockItem.requirement,
          description: undefined,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).not.toContain('drawer-plain-description');
      expect(html).not.toContain('Plain-Language Requirement Description');
      expect(html).toContain('Verbatim Tender Clause');
      expect(html).toContain(
        'The minimum average annual turnover of the bidder during the last 3 financial years shall not be less than Rs 50.00 Crores.',
      );
    });

    it('renders nothing when isOpen is false', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: mockItem.sourceCitation,
          provenance: mockItem.provenance,
          requirementTitle: mockItem.requirement,
          description: mockItem.description,
          isOpen: false,
          onClose: vi.fn(),
        }),
      );

      expect(html).toBe('');
    });
  });
});
