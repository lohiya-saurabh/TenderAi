import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BidVerdictCard, DisqualifierItemCard } from '../BidVerdictCard.js';
import type { BidDetail } from '@/api/bids.js';
import type { ComplianceItem } from '@/api/compliance.js';
import type { BidDecision } from '../bidDetailData.js';

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, '');
}

describe('BidVerdictCard & DisqualifierItemCard (F10 - No Raw JSON)', () => {
  const mockBid: BidDetail = {
    id: 'bid-test-101',
    tenderId: 'tender-nhai-01',
    tenderTitle: 'Four Laning of NH-44 Greenfield Corridor',
    authority: 'NHAI',
    status: 'DECIDED',
    verdict: 'NO_GO',
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T11:00:00Z',
    sourceDocument: '02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf',
    submissionDeadline: '2026-11-20T17:00:00Z',
  };

  const mockComplianceItems: ComplianceItem[] = [
    {
      id: 'comp-1',
      bidId: 'bid-test-101',
      requirement: 'Average Annual Turnover >= ₹350 Cr in last 3 financial years',
      category: 'FINANCIAL',
      isMandatory: true,
      tenderClauseRef: 'Clause 4.1',
      status: 'FAIL',
      risk: { level: 'HIGH', category: 'FINANCIAL', summary: 'Turnover shortfall of ₹68.10 Cr' },
      humanReviewRequired: false,
    },
  ];

  describe('DisqualifierItemCard Isolated Tests', () => {
    it('should render structured object with title, reason, shortfall badge, and clause reference tag', () => {
      const rawItem = {
        requirement_title: 'Annual Financial Turnover',
        reason: 'Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.',
        clause_reference: 'Clause 4.1 Financial Eligibility',
        shortfall_detail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem }));

      expect(html).toContain('Annual Financial Turnover');
      expect(html).toContain('Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.');
      expect(html).toContain('Shortfall:');
      expect(html).toContain('Required: ₹350.00 Cr | Found: ₹281.90 Cr');
      expect(html).toContain('Clause 4.1 Financial Eligibility');
      // Assert zero raw JSON syntax in rendered HTML
      expect(html).not.toContain('{"');
      expect(html).not.toContain('":');
    });

    it('should render stringified JSON string without raw JSON syntax in output', () => {
      const jsonString = JSON.stringify({
        requirement_title: 'Valid Class-1 Contractor License',
        reason: 'Contractor license expired on 2026-03-31 and renewal is pending.',
        clause_reference: 'Clause 2.3 Registration',
        shortfall_detail: 'License status: EXPIRED',
        factor: 'LEGAL',
      });

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: jsonString }));

      expect(html).toContain('Valid Class-1 Contractor License');
      expect(html).toContain('Contractor license expired on 2026-03-31 and renewal is pending.');
      expect(html).toContain('License status: EXPIRED');
      expect(html).toContain('Clause 2.3 Registration');
      expect(html).toContain('LEGAL');
      // Verify complete elimination of raw JSON
      expect(html).not.toContain('{"requirement_title"');
      expect(html).not.toContain('\\"');
    });

    it('should render plain text string disqualifier cleanly', () => {
      const html = render(
        React.createElement(DisqualifierItemCard, {
          rawItem: 'Blacklisting: Debarred by National Highway Authority of India',
        }),
      );

      expect(html).toContain('Blacklisting');
      expect(html).toContain('Debarred by National Highway Authority of India');
    });

    it('should render category badge uppercase and clean nested object shortfall detail', () => {
      const rawItem = {
        title: 'Negative Net Worth',
        reason: 'Net worth falls below minimum threshold',
        category: 'FINANCIAL',
        clauseRef: 'Clause 3.1.4',
        shortfall: { required: '₹50.00 Cr', found: '-₹12.40 Cr' },
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem }));

      expect(html).toContain('Negative Net Worth');
      expect(html).toContain('FINANCIAL');
      expect(html).toContain('Clause 3.1.4');
      expect(html).toContain('Required: ₹50.00 Cr | Found: -₹12.40 Cr');
      expect(html).not.toContain('[object Object]');
      expect(html).not.toContain('{"');
    });

    it('should strip duplicate Shortfall: prefix from shortfall detail', () => {
      const rawItem = {
        title: 'Equipment Deficit',
        reason: 'Missing required sensor paver',
        shortfall_detail: 'Shortfall: 2 units required, 0 available',
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem }));

      expect(html).toContain('Equipment Deficit');
      expect(html).toContain('Shortfall:');
      expect(html).toContain('2 units required, 0 available');
      expect(html).not.toContain('Shortfall: Shortfall:');
    });

    it('should return null for nullish or invalid input', () => {
      const htmlNull = render(React.createElement(DisqualifierItemCard, { rawItem: null }));
      expect(htmlNull).toBe('');

      const htmlEmpty = render(React.createElement(DisqualifierItemCard, { rawItem: '' }));
      expect(htmlEmpty).toBe('');
    });
  });

  describe('BidVerdictCard Integration Tests', () => {
    it('should render structured cards for all hard disqualifiers with zero raw JSON on screen', () => {
      const decisionWithDisqualifiers: BidDecision = {
        bidId: 'bid-test-101',
        verdict: 'DO_NOT_PURSUE',
        evaluatedAt: '2026-10-15T10:05:00Z',
        evaluatedFactors: 12,
        reasons: ['Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.'],
        hardDisqualifiers: [
          // Object shape from AiDecisionClient
          {
            requirement_title: 'Annual Financial Turnover',
            reason: 'Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.',
            clause_reference: 'Clause 4.1',
            shortfall_detail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
          },
          // Stringified JSON shape
          JSON.stringify({
            requirement_title: 'Equipment Ownership (Sensor Paver)',
            reason: 'Bidder does not own or lease minimum 2 sensor pavers required.',
            clause_reference: 'Clause 6.2 Equipment',
            shortfall_detail: 'Found: 0 units | Required: 2 units',
          }),
        ],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision: decisionWithDisqualifiers,
        }),
      );

      // Verify the callout header
      expect(html).toContain('Hard Disqualifiers (2)');

      // Verify Card 1
      expect(html).toContain('Annual Financial Turnover');
      expect(html).toContain('Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.');
      expect(html).toContain('Clause 4.1');
      expect(html).toContain('Required: ₹350.00 Cr | Found: ₹281.90 Cr');

      // Verify Card 2 (from stringified JSON)
      expect(html).toContain('Equipment Ownership (Sensor Paver)');
      expect(html).toContain('Bidder does not own or lease minimum 2 sensor pavers required.');
      expect(html).toContain('Clause 6.2 Equipment');
      expect(html).toContain('Found: 0 units | Required: 2 units');

      // VERIFY ZERO RAW JSON: neither JSON.stringify syntax nor escaped quotes
      expect(html).not.toContain('{"requirement_title"');
      expect(html).not.toContain('{"reason"');
      expect(html).not.toContain('&quot;requirement_title&quot;');
      expect(html).not.toContain('JSON.stringify');
    });

    it('should not render hard disqualifiers callout when list is empty or absent', () => {
      const decisionWithoutDisqualifiers: BidDecision = {
        bidId: 'bid-test-101',
        verdict: 'PURSUE',
        evaluatedAt: '2026-10-15T10:05:00Z',
        evaluatedFactors: 10,
        reasons: ['All mandatory eligibility criteria met.'],
        hardDisqualifiers: [],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision: decisionWithoutDisqualifiers,
        }),
      );

      expect(html).not.toContain('Hard Disqualifiers');
      expect(html).not.toContain('data-testid="hard-disqualifiers-callout"');
    });

    it('should parse stringified JSON evidence citations and reasons cleanly with zero raw JSON in DOM', () => {
      const decisionWithJsonCitations: BidDecision = {
        bidId: 'bid-test-101',
        verdict: 'PURSUE',
        evaluatedAt: '2026-10-15T10:05:00Z',
        evaluatedFactors: 8,
        reasons: [
          'Turnover exceeds threshold with verified CA audit',
        ],
        reasonsToPursue: [
          JSON.stringify({
            title: 'Turnover Qualification',
            reason: '3-Year Average Turnover exceeds requirement',
          }),
        ],
        evidenceCitations: [
          JSON.stringify({
            tender_requirement_title: 'CA Certified Turnover',
            notes: 'Verified from FY 2023-24 Balance Sheet with valid UDIN',
            document_name: 'Audited_Balance_Sheet.pdf',
            page_number: 14,
          }),
        ],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision: decisionWithJsonCitations,
        }),
      );

      expect(html).toContain('CA Certified Turnover');
      expect(html).toContain('Verified from FY 2023-24 Balance Sheet with valid UDIN');
      expect(html).toContain('Audited_Balance_Sheet.pdf');
      expect(html).toContain('p. 14');
      // Assert zero raw JSON syntax anywhere in rendered markup
      expect(html).not.toContain('{"tender_requirement_title"');
      expect(html).not.toContain('{"title"');
      expect(html).not.toContain('&quot;');
    });
  });
});
