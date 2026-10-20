import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MarkdownMessage } from '../MarkdownMessage.js';
import { FinancialSummaryCard } from '../FinancialSummaryCard.js';
import { CitationPreviewModal } from '../CitationPreviewModal.js';
import { ChatCopilotDrawer } from '../ChatCopilotDrawer.js';
import type { CitationDto, FinancialSummaryCardDto } from '@tenderpulse/shared-types';

/**
 * Strips React SSR comment delimiters (<!-- -->) so text assertions match JSX interpolation seamlessly.
 */
function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, '');
}

describe('Chat Copilot Web Components Suite', () => {
  describe('MarkdownMessage Component', () => {
    it('renders basic paragraphs, headings, bullet lists, and blockquotes', () => {
      const markdown = [
        '# Header 1',
        '## Header 2',
        '### Header 3',
        '> Statutory warning clause',
        '- Minimum turnover of 50 Cr',
        '* ISO 9001 certification required',
        'Normal explanatory paragraph.',
      ].join('\n');

      const html = render(
        React.createElement(MarkdownMessage, { content: markdown }),
      );

      expect(html).toContain('<h1');
      expect(html).toContain('Header 1');
      expect(html).toContain('<h2');
      expect(html).toContain('Header 2');
      expect(html).toContain('<h3');
      expect(html).toContain('Header 3');
      expect(html).toContain('<blockquote');
      expect(html).toContain('Statutory warning clause');
      expect(html).toContain('Minimum turnover of 50 Cr');
      expect(html).toContain('ISO 9001 certification required');
      expect(html).toContain('Normal explanatory paragraph.');
    });

    it('renders tables with header and data rows', () => {
      const tableMarkdown = [
        '| Metric | Required | Actual |',
        '| --- | --- | --- |',
        '| Net Worth | ₹ 10 Cr | ₹ 18.5 Cr |',
        '| Working Capital | ₹ 5 Cr | ₹ 7.2 Cr |',
      ].join('\n');

      const html = render(
        React.createElement(MarkdownMessage, { content: tableMarkdown }),
      );

      expect(html).toContain('<table');
      expect(html).toContain('<thead');
      expect(html).toContain('<tbody');
      expect(html).toContain('Net Worth');
      expect(html).toContain('₹ 10 Cr');
      expect(html).toContain('₹ 18.5 Cr');
      expect(html).toContain('Working Capital');
    });

    it('correctly parses tables containing escaped pipes in cell content', () => {
      const tableWithEscapedPipe = [
        '| Requirement | Verification \\| Proof | Status |',
        '| --- | --- | --- |',
        '| MAAT Turnover | CA Certificate \\| UDIN mandatory | PASS |',
      ].join('\n');

      const html = render(
        React.createElement(MarkdownMessage, { content: tableWithEscapedPipe }),
      );

      expect(html).toContain('Verification | Proof');
      expect(html).toContain('CA Certificate | UDIN mandatory');
      expect(html).toContain('PASS');
    });

    it('renders numbered lists with index badges and clean text formatting', () => {
      const numberedList = [
        '1. Deposit EMD of INR 5,00,000 on stamp paper',
        '2. Obtain CA certificate with valid 18-digit UDIN',
        '3. Sign Integrity Pact before closing date',
      ].join('\n');

      const html = render(
        React.createElement(MarkdownMessage, { content: numberedList }),
      );

      expect(html).toContain('1.');
      expect(html).toContain('Deposit EMD of INR 5,00,000');
      expect(html).toContain('2.');
      expect(html).toContain('Obtain CA certificate with valid 18-digit UDIN');
      expect(html).toContain('3.');
    });

    it('renders inline formatting: bold, italic, code, and citations', () => {
      const text = 'Bidder must submit **EMD BG** and `Form-IV` *promptly* [^1] and [2].';

      const html = render(
        React.createElement(MarkdownMessage, { content: text }),
      );

      expect(html).toContain('<strong');
      expect(html).toContain('EMD BG');
      expect(html).toContain('<code');
      expect(html).toContain('Form-IV');
      expect(html).toContain('<em');
      expect(html).toContain('promptly');
      expect(html).toContain('[1]');
      expect(html).toContain('[2]');
      expect(html).toContain('View Citation #1');
      expect(html).toContain('View Citation #2');
    });
  });

  describe('FinancialSummaryCard Component', () => {
    it('renders PASS verdict with Qualified badge, values, and UDIN', () => {
      const summary: FinancialSummaryCardDto = {
        metricName: '3-Year Average Annual Turnover',
        requiredValue: '₹ 25.00 Cr',
        actualValue: '₹ 45.80 Cr',
        verdict: 'PASS',
        udin: '24012345ABCDE1234',
        details: 'Verified against statutory audited financial statements filed with MCA.',
      };

      const html = render(
        React.createElement(FinancialSummaryCard, { summary }),
      );

      expect(html).toContain('3-Year Average Annual Turnover');
      expect(html).toContain('PASS');
      expect(html).toContain('₹ 25.00 Cr');
      expect(html).toContain('₹ 45.80 Cr');
      expect(html).toContain('UDIN: 24012345ABCDE1234');
      expect(html).toContain('Verified against statutory audited financial statements');
    });

    it('renders FAIL and REVIEW verdicts with appropriate badge styles', () => {
      const failSummary: FinancialSummaryCardDto = {
        metricName: 'Working Capital Ratio',
        requiredValue: '1.20',
        actualValue: '0.95',
        verdict: 'FAIL',
        details: 'Insufficient liquidity cushion under tender specifications.',
      };

      const reviewSummary: FinancialSummaryCardDto = {
        metricName: 'Solvency Certificate',
        requiredValue: '₹ 15.00 Cr',
        actualValue: '₹ 12.00 Cr (Joint Venture pending)',
        verdict: 'REVIEW',
      };

      const failHtml = render(
        React.createElement(FinancialSummaryCard, { summary: failSummary }),
      );
      expect(failHtml).toContain('Working Capital Ratio');
      expect(failHtml).toContain('FAIL');
      expect(failHtml).toContain('Insufficient liquidity cushion');

      const reviewHtml = render(
        React.createElement(FinancialSummaryCard, { summary: reviewSummary }),
      );
      expect(reviewHtml).toContain('Solvency Certificate');
      expect(reviewHtml).toContain('REVIEW');
    });
  });

  describe('CitationPreviewModal Component', () => {
    it('returns null when citation is not provided', () => {
      const html = render(
        React.createElement(CitationPreviewModal, {
          citation: null,
          onClose: () => {},
        }),
      );

      expect(html).toBe('');
    });

    it('renders tender document provenance with verbatim quote and confidence score', () => {
      const citation: CitationDto = {
        citationId: 'cit-tender-01',
        documentName: 'NIT_Section_4_Technical_Eligibility.pdf',
        pageNumber: 14,
        clauseReference: 'Clause 4.3.2(b)',
        verbatimQuote: 'The bidder shall have completed at least one similar railway signalling work.',
        confidenceScore: 0.96,
        sourceType: 'TENDER_DOCUMENT',
      };

      const html = render(
        React.createElement(CitationPreviewModal, {
          citation,
          onClose: () => {},
        }),
      );

      expect(html).toContain('Citation Provenance');
      expect(html).toContain('Tender Document');
      expect(html).toContain('NIT_Section_4_Technical_Eligibility.pdf');
      expect(html).toContain('Page 14 • Clause 4.3.2(b)');
      expect(html).toContain('96% Grounded');
      expect(html).toContain('The bidder shall have completed at least one similar railway signalling work.');
    });

    it('renders company evidence provenance for company vault sources', () => {
      const citation: CitationDto = {
        citationId: 'cit-comp-01',
        documentName: 'CA_Certified_Turnover_FY24.pdf',
        pageNumber: 2,
        verbatimQuote: 'Total certified turnover for FY 2023-24 is INR 52.4 Crores.',
        confidenceScore: 0.99,
        sourceType: 'COMPANY_EVIDENCE',
      };

      const html = render(
        React.createElement(CitationPreviewModal, {
          citation,
          onClose: () => {},
        }),
      );

      expect(html).toContain('Company Evidence Vault');
      expect(html).toContain('CA_Certified_Turnover_FY24.pdf');
      expect(html).toContain('Page 2');
      expect(html).toContain('99% Grounded');
      expect(html).toContain('Total certified turnover for FY 2023-24 is INR 52.4 Crores.');
    });
  });

  describe('ChatCopilotDrawer Component', () => {
    it('returns null when isOpen is false', () => {
      const html = render(
        React.createElement(ChatCopilotDrawer, {
          isOpen: false,
          onClose: () => {},
          bidId: 'bid-123',
        }),
      );

      expect(html).toBe('');
    });

    it('renders responsive drawer layout classes for mobile and desktop screens', () => {
      const html = render(
        React.createElement(ChatCopilotDrawer, {
          isOpen: true,
          onClose: () => {},
          bidId: 'bid-123',
        }),
      );

      // Verify responsive container classes: w-full on mobile, sm:w-[540px] on desktop
      expect(html).toContain('w-full');
      expect(html).toContain('sm:w-[540px]');
      expect(html).toContain('fixed inset-y-0 right-0');
      expect(html).toContain('z-40');
    });

    it('renders citation pills with interactive click hints and dual provenance badges', () => {
      const citation: CitationDto = {
        citationId: 'cit-tender-99',
        documentName: 'NHAI_NIT_baswantpur.pdf',
        pageNumber: 3,
        clauseReference: 'Clause 4.1',
        verbatimQuote: 'EMD of INR 9.72 Crores required.',
        confidenceScore: 0.98,
        sourceType: 'TENDER_DOCUMENT',
      };

      const html = render(
        React.createElement(CitationPreviewModal, {
          citation,
          onClose: () => {},
        }),
      );

      expect(html).toContain('z-50'); // Modal is higher than drawer (z-40)
      expect(html).toContain('NHAI_NIT_baswantpur.pdf');
      expect(html).toContain('Page 3 • Clause 4.1');
      expect(html).toContain('98% Grounded');
    });

    it('renders bounding box highlight metadata when present on citation', () => {
      const citationWithBox: CitationDto = {
        citationId: 'cit-box-01',
        documentName: 'Tender_Document.pdf',
        pageNumber: 5,
        clauseReference: 'Clause 12.1',
        verbatimQuote: 'Notarized affidavit on INR 500 stamp paper.',
        confidenceScore: 0.99,
        sourceType: 'TENDER_DOCUMENT',
        boundingBox: {
          x: 100,
          y: 250,
          width: 400,
          height: 80,
          pageWidth: 612,
          pageHeight: 792,
        },
      };

      const html = render(
        React.createElement(CitationPreviewModal, {
          citation: citationWithBox,
          onClose: () => {},
        }),
      );

      expect(html).toContain('Document Viewer Snippet');
      expect(html).toContain('Notarized affidavit on INR 500 stamp paper.');
    });
  });
});
