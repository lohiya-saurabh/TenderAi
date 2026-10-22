import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComplianceRow } from '../ComplianceRow.js';
import { SourceCitationDrawer } from '../SourceCitationDrawer.js';
import type { ComplianceItem } from '@/api/compliance.js';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext.js';

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'user-adversarial-1',
    email: 'challenger@tenderpulse.internal',
    role: 'PROPOSAL_MANAGER',
    companyId: 'comp-challenger',
    name: 'Stress Challenger',
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

const baseItem: ComplianceItem = {
  id: 'item-stress-001',
  bidId: 'bid-stress-999',
  requirement: 'Base Requirement Title',
  description: 'Base Description',
  category: 'TECHNICAL',
  subCategory: 'Technical Capability',
  isMandatory: true,
  tenderClauseRef: 'Clause 7.1.A',
  status: 'PASS',
  companyEvidence: {
    id: 'ev-stress-1',
    title: 'Certified Experience Record',
    docType: 'COMPLETION_CERTIFICATE',
    status: 'VERIFIED',
    udinNumber: '24099999BBBBB9999',
  },
  risk: {
    level: 'MEDIUM',
    category: 'TECHNICAL',
    summary: 'Standard technical risk.',
  },
  rationale: {
    ruleApplied: 'Experience >= 5 years',
    tenderRequirement: '5 years',
    companyCapability: '7 years verified',
    comparisonResult: 'MET',
    confidenceScore: 0.95,
    details: ['Verified via Completion Certificate'],
  },
  provenance: {
    documentId: 'doc-nit-stress',
    documentName: 'NIT_Stress_Testing_Document.pdf',
    pageNumber: 42,
    sectionOrClause: 'Clause 7.1.A',
    verbatimQuote: 'Bidder must possess at least 5 years of experience in EPC road projects.',
    confidenceScore: 0.95,
  },
  sourceCitation: {
    document: 'NIT_Stress_Testing_Document.pdf',
    page: 42,
    section: 'Clause 7.1.A',
    verbatimQuote: 'Bidder must possess at least 5 years of experience in EPC road projects.',
    confidenceScore: 0.95,
  },
  humanReviewRequired: false,
  version: 1,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

describe('Adversarial Stress Testing: ComplianceRow & SourceCitationDrawer R1', () => {
  describe('Case 1: Multi-Paragraph Long Descriptions & Word-Wrapping', () => {
    const multiParagraphDesc = [
      'Paragraph 1: The bidder shall submit audited financial statements for the preceding three fiscal years.',
      'Paragraph 2: In addition, a certificate of solvency issued by a scheduled commercial bank in India for an amount not less than ₹25 Crore must be enclosed.',
      'Paragraph 3: Any joint venture partner contributing less than 26% equity shall not be considered for technical qualification scoring under section 4.3.',
      'Paragraph 4: All figures must be denominated in Indian Rupees (INR) and duly authenticated with a 18-digit UDIN.',
    ].join('\n\n');

    const multiParaItem: ComplianceItem = {
      ...baseItem,
      id: 'item-multi-para',
      requirement: 'Financial Solvency and JV Threshold Rules',
      description: multiParagraphDesc,
    };

    it('NEVER renders multi-paragraph description text in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: multiParaItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Collapsed row must display requirement title
      expect(html).toContain('Financial Solvency and JV Threshold Rules');
      expect(html).toContain('Clause 7.1.A');

      // Collapsed row must NOT leak any of the 4 paragraphs
      expect(html).not.toContain('Paragraph 1:');
      expect(html).not.toContain('Paragraph 2:');
      expect(html).not.toContain('Paragraph 3:');
      expect(html).not.toContain('Paragraph 4:');
      expect(html).not.toContain('audited financial statements');
      expect(html).not.toContain('certificate of solvency');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('faithfully renders multi-paragraph description in expanded Question 1 with whitespace-pre-line and break-words', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: multiParaItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('compliance-plain-description');
      expect(html).toContain('whitespace-pre-line');
      expect(html).toContain('break-words');
      expect(html).toContain('Paragraph 1: The bidder shall submit');
      expect(html).toContain('Paragraph 4: All figures must be denominated');
    });

    it('renders full multi-paragraph description in SourceCitationDrawer with word-break safety', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: multiParaItem.sourceCitation,
          provenance: multiParaItem.provenance,
          requirementTitle: multiParaItem.requirement,
          description: multiParaItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).toContain('drawer-plain-description');
      expect(html).toContain('Paragraph 1: The bidder shall submit');
      expect(html).toContain('Paragraph 2: In addition');
      expect(html).toContain('word-break:break-word');
    });
  });

  describe('Case 2: Ultra-Long Continuous Strings (No Spaces / Overflow Stress)', () => {
    const unbreakString = 'A'.repeat(256) + '_SUPERLONG_TOKEN_' + 'Z'.repeat(128);
    const unbreakItem: ComplianceItem = {
      ...baseItem,
      id: 'item-unbreak',
      requirement: 'Long Token Requirement',
      description: unbreakString,
    };

    it('NEVER leaks ultra-long unbroken string in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: unbreakItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('Long Token Requirement');
      expect(html).not.toContain(unbreakString);
      expect(html).not.toContain('_SUPERLONG_TOKEN_');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('renders ultra-long unbroken string inside break-words container when expanded', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: unbreakItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('compliance-plain-description');
      expect(html).toContain(unbreakString);
      expect(html).toContain('break-words');
    });

    it('renders ultra-long unbroken string inside drawer with word-break:break-word', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: unbreakItem.sourceCitation,
          provenance: unbreakItem.provenance,
          requirementTitle: unbreakItem.requirement,
          description: unbreakItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).toContain('drawer-plain-description');
      expect(html).toContain(unbreakString);
      expect(html).toContain('word-break:break-word');
    });
  });

  describe('Case 3: HTML Injection & Special Characters (<, >, &, ", \', /)', () => {
    const maliciousDesc =
      '<script>alert("XSS")</script> & <div style="display:none">secret</div> "quoted" \'single-quoted\' &amp; &lt;b&gt;bold&lt;/b&gt;';

    const xssItem: ComplianceItem = {
      ...baseItem,
      id: 'item-xss',
      requirement: 'Special Characters & XSS Test',
      description: maliciousDesc,
    };

    it('NEVER leaks malicious or HTML-containing description in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: xssItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('Special Characters &amp; XSS Test');
      expect(html).not.toContain('alert(&quot;XSS&quot;)');
      expect(html).not.toContain('secret');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('safely escapes HTML tags in expanded Question 1 card without executing or injecting raw HTML elements', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: xssItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('compliance-plain-description');
      // Must be HTML-escaped text, not an actual HTML tag
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).toContain('&amp; &lt;div style=&quot;display:none&quot;&gt;secret&lt;/div&gt;');
      // Must NOT contain an unescaped raw <script> tag
      expect(html).not.toMatch(/<script>alert/);
    });

    it('safely escapes HTML tags in SourceCitationDrawer without injecting raw HTML elements', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: xssItem.sourceCitation,
          provenance: xssItem.provenance,
          requirementTitle: xssItem.requirement,
          description: xssItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).toContain('drawer-plain-description');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).not.toMatch(/<script>alert/);
    });
  });

  describe('Case 4: Empty String Descriptions ("")', () => {
    const emptyDescItem: ComplianceItem = {
      ...baseItem,
      id: 'item-empty-desc',
      requirement: 'Requirement with Empty Description',
      description: '',
    };

    it('does not render description container in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: emptyDescItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('Requirement with Empty Description');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('does NOT render compliance-plain-description container in expanded ComplianceRow when empty string', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: emptyDescItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('1. What does the tender require?');
      expect(html).toContain('Requirement with Empty Description');
      expect(html).not.toContain('compliance-plain-description');
      expect(html).not.toContain('Plain-Language Description');
    });

    it('does NOT render drawer-plain-description card in SourceCitationDrawer when empty string', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: emptyDescItem.sourceCitation,
          provenance: emptyDescItem.provenance,
          requirementTitle: emptyDescItem.requirement,
          description: '',
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).not.toContain('drawer-plain-description');
      expect(html).not.toContain('Plain-Language Requirement Description');
    });
  });

  describe('Case 5: Whitespace-Only Descriptions ("   \\n\\t  ")', () => {
    const whitespaceDescItem: ComplianceItem = {
      ...baseItem,
      id: 'item-whitespace-desc',
      requirement: 'Requirement with Whitespace Description',
      description: '   \n\t   \n  ',
    };

    it('NEVER renders description text in collapsed ComplianceRow', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: whitespaceDescItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('Requirement with Whitespace Description');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('inspects expanded ComplianceRow behavior under whitespace-only description', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: whitespaceDescItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Verify whether the truthy whitespace string renders the container or if it behaves safely
      expect(html).toContain('1. What does the tender require?');
      expect(html).toContain('Requirement with Whitespace Description');
    });
  });

  describe('Case 6: Undefined Descriptions', () => {
    const undefinedDescItem: ComplianceItem = {
      ...baseItem,
      id: 'item-undefined-desc',
      requirement: 'Requirement with Undefined Description',
      description: undefined,
    };

    it('does not render description in collapsed row', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: undefinedDescItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('Requirement with Undefined Description');
      expect(html).not.toContain('compliance-plain-description');
    });

    it('omits plain-description card in expanded row when undefined', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: undefinedDescItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).not.toContain('compliance-plain-description');
      expect(html).not.toContain('Plain-Language Description');
    });

    it('omits plain-description card in drawer when undefined', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: undefinedDescItem.sourceCitation,
          provenance: undefinedDescItem.provenance,
          requirementTitle: undefinedDescItem.requirement,
          description: undefined,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).not.toContain('drawer-plain-description');
    });
  });

  describe('Case 7: Identical Requirement Title and Description', () => {
    const identicalText = 'Bidder must provide a bid security of INR 2.50 Crores in the form of a Bank Guarantee.';
    const identicalItem: ComplianceItem = {
      ...baseItem,
      id: 'item-identical',
      requirement: identicalText,
      description: identicalText,
    };

    it('renders requirement title exactly ONCE in collapsed ComplianceRow (no inline description duplicate)', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: identicalItem,
          isExpanded: false,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      // Count occurrences of identicalText in collapsed row HTML
      const occurrences = (html.match(new RegExp(identicalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      
      // In collapsed row, it should appear in:
      // 1. Line 87: title="{item.requirement}"
      // 2. Line 89: {item.requirement}
      // It must NOT appear as a third occurrence in an inline description paragraph!
      expect(occurrences).toBe(2);
      expect(html).not.toContain('compliance-plain-description');
    });

    it('renders both title and plain-language description in expanded Question 1 card', () => {
      const html = render(
        React.createElement(ComplianceRow, {
          item: identicalItem,
          isExpanded: true,
          onToggleExpand: vi.fn(),
          onReview: vi.fn(),
        }),
      );

      expect(html).toContain('1. What does the tender require?');
      expect(html).toContain('compliance-plain-description');
      expect(html).toContain('Plain-Language Description');
    });

    it('renders plain-language description in SourceCitationDrawer alongside header requirement description', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: identicalItem.sourceCitation,
          provenance: identicalItem.provenance,
          requirementTitle: identicalItem.requirement,
          description: identicalItem.description,
          isOpen: true,
          onClose: vi.fn(),
        }),
      );

      expect(html).toContain('drawer-plain-description');
      expect(html).toContain('Plain-Language Requirement Description');
    });
  });

  describe('Case 8: Permutation Matrix Verification for Zero Row Leaks', () => {
    const categories: Array<ComplianceItem['category']> = [
      'TECHNICAL',
      'FINANCIAL',
      'LEGAL',
      'STATUTORY',
      'EXPERIENCE',
      'SAFETY',
    ];
    const statuses: Array<ComplianceItem['status']> = ['PASS', 'FAIL', 'REVIEW', 'PENDING'];
    const risks: Array<ComplianceItem['risk']['level']> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    it('guarantees zero description leaks across all category x status x risk combinations', () => {
      const secretMarker = 'SECRET_CONCEALED_DESCRIPTION_LEAK_TEST_MARKER';

      categories.forEach((cat) => {
        statuses.forEach((st) => {
          risks.forEach((rk) => {
            const testItem: ComplianceItem = {
              ...baseItem,
              id: `item-${cat}-${st}-${rk}`,
              category: cat,
              status: st,
              risk: {
                level: rk,
                category: cat,
                summary: 'Permutation risk',
              },
              requirement: `Obligation for ${cat} / ${st} / ${rk}`,
              description: `${secretMarker} for category ${cat} status ${st} risk ${rk}`,
            };

            const html = render(
              React.createElement(ComplianceRow, {
                item: testItem,
                isExpanded: false,
                onToggleExpand: vi.fn(),
                onReview: vi.fn(),
              }),
            );

            // Collapsed row must display requirement headline
            expect(html).toContain(`Obligation for ${cat} / ${st} / ${rk}`);
            // Collapsed row must NEVER contain secretMarker
            expect(html).not.toContain(secretMarker);
            expect(html).not.toContain('compliance-plain-description');
          });
        });
      });
    });
  });

  describe('Case 9: Drawer Closed State Invariance', () => {
    it('never renders any content when isOpen is false, regardless of description length or content', () => {
      const html = render(
        React.createElement(SourceCitationDrawer, {
          citation: baseItem.sourceCitation,
          provenance: baseItem.provenance,
          requirementTitle: 'Closed Drawer Requirement',
          description: 'A very important description that should not render when closed',
          isOpen: false,
          onClose: vi.fn(),
        }),
      );

      expect(html).toBe('');
    });
  });
});
