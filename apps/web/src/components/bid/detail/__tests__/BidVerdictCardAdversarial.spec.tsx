import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DisqualifierItemCard, BidVerdictCard } from '../BidVerdictCard.js';
import type { BidDetail } from '@/api/bids.js';
import type { ComplianceItem } from '@/api/compliance.js';
import type { BidDecision } from '../bidDetailData.js';

function render(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, '');
}

/**
 * Asserts that the rendered HTML contains:
 * 1. ZERO raw JSON syntax: no '{"', no '":', no '&quot;:', no escaped quotes with braces.
 * 2. ZERO '[object Object]'.
 * 3. ZERO unparsed markdown code fences (```json or ```).
 */
function assertZeroRawJson(html: string): void {
  expect(html).not.toContain('[object Object]');
  expect(html).not.toContain('{"');
  expect(html).not.toContain('":');
  expect(html).not.toContain('&quot;:');
  expect(html).not.toContain('```json');
  expect(html).not.toContain('```');
  expect(html).not.toMatch(/\\"[a-zA-Z0-9_]+\\":/);
}

describe('BidVerdictCard & DisqualifierItemCard — Adversarial Stress Suite', () => {
  const mockBid: BidDetail = {
    id: 'bid-adv-999',
    tenderId: 'tender-adv-01',
    tenderTitle: 'Adversarial Defense Infrastructure Tender',
    authority: 'NHAI',
    status: 'DECIDED',
    verdict: 'NO_GO',
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T11:00:00Z',
    sourceDocument: 'NIT_Adversarial.pdf',
    submissionDeadline: '2026-11-20T17:00:00Z',
    estimatedValueRupees: 500000000,
  };

  const mockComplianceItems: ComplianceItem[] = [];

  describe('1. Double and Multi-Stringified JSON Payloads', () => {
    it('should parse double-stringified JSON without leaking raw quotes or brackets', () => {
      const payload = JSON.stringify(
        JSON.stringify({
          requirement_title: 'Double Stringified Turnover',
          reason: 'Turnover falls short by ₹68.10 Cr.',
          clause_reference: 'Clause 4.1',
          shortfall_detail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
          factor: 'FINANCIAL',
        }),
      );

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Double Stringified Turnover');
      expect(html).toContain('Turnover falls short by ₹68.10 Cr.');
      expect(html).toContain('Clause 4.1');
      assertZeroRawJson(html);
    });

    it('should handle triple-stringified JSON without leaking escaped JSON artifacts into DOM', () => {
      const payload = JSON.stringify(
        JSON.stringify(
          JSON.stringify({
            requirement_title: 'Triple Stringified Debarment',
            reason: 'Bidder is barred by central authority.',
            clause_reference: 'Clause 1.2',
          }),
        ),
      );

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Triple Stringified Debarment');
      expect(html).toContain('Bidder is barred by central authority.');
      assertZeroRawJson(html);
    });
  });

  describe('2. Deeply Nested Objects', () => {
    it('should cleanly extract text from deeply nested requirement and shortfall objects without [object Object]', () => {
      const payload = {
        requirement: {
          title: 'Machinery Equipment Ownership',
          subCategory: 'TECHNICAL',
        },
        reason: {
          explanation: 'Contractor does not possess required 2 sensor pavers.',
        },
        shortfall: {
          required: { count: 2, unit: 'sensor pavers' },
          found: { count: 0, unit: 'sensor pavers' },
        },
        clause: { reference: 'Clause 6.2 Equipment' },
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Machinery Equipment Ownership');
      expect(html).toContain('Contractor does not possess required 2 sensor pavers.');
      assertZeroRawJson(html);
    });

    it('should extract human-readable text from arbitrarily nested structures', () => {
      const payload = {
        title: { value: 'Bank Solvency Guarantee' },
        reason: { detail: { text: 'Bank credit letter is invalid' } },
        shortfall_detail: {
          deficit: { amount: '₹20.00 Cr', currency: 'INR' },
        },
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Bank Solvency Guarantee');
      expect(html).toContain('Bank credit letter is invalid');
      assertZeroRawJson(html);
    });
  });

  describe('3. JSON Strings with Unescaped Newlines, Trailing Commas, or Markdown Backticks', () => {
    it('should unpack markdown code-fence wrapped JSON without leaking backticks or raw JSON syntax', () => {
      const payload = `\`\`\`json
{
  "requirement_title": "Active Litigation Limit Exceeded",
  "reason": "Litigation claims exceed 25% of net worth.",
  "clause_reference": "Section II - Clause 3.4",
  "shortfall_detail": "Claims at 38% vs 25% limit",
  "factor": "LEGAL"
}
\`\`\``;

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Active Litigation Limit Exceeded');
      expect(html).toContain('Litigation claims exceed 25% of net worth.');
      expect(html).toContain('Section II - Clause 3.4');
      assertZeroRawJson(html);
    });

    it('should handle markdown code-fences without language tag (``` {...} ```)', () => {
      const payload = `\`\`\`
{
  "requirement_title": "GST Compliance Failure",
  "reason": "Firm has active GST suspension order.",
  "clause_reference": "Clause 1.8"
}
\`\`\``;

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('GST Compliance Failure');
      expect(html).toContain('Firm has active GST suspension order.');
      assertZeroRawJson(html);
    });

    it('should handle JSON with trailing commas gracefully without raw JSON syntax leakage', () => {
      const payload = `{
  "requirement_title": "Blacklist Status",
  "reason": "Debarred by Ministry of Road Transport & Highways",
  "clause_reference": "Clause 2.1",
  "shortfall_detail": "Debarred until 2028",
}`;

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Blacklist Status');
      expect(html).toContain('Debarred by Ministry of Road Transport & Highways');
      assertZeroRawJson(html);
    });

    it('should handle JSON with unescaped newlines and tabs', () => {
      const payload = `{\n\t"requirement_title": "Safety Record Shortfall",\n\t"reason": "Fatal incident reported in past 3 years",\n\t"clause_reference": "Clause 8.1"\n}`;

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Safety Record Shortfall');
      expect(html).toContain('Fatal incident reported in past 3 years');
      assertZeroRawJson(html);
    });
  });

  describe('4. Array of Objects and Primitive Arrays', () => {
    it('should unpack an array of disqualifier objects passed to DisqualifierItemCard without rendering null/empty', () => {
      const payload = [
        {
          title: 'Turnover Deficit',
          reason: 'Company turnover below threshold',
        },
      ];

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Turnover Deficit');
      expect(html).toContain('Company turnover below threshold');
      assertZeroRawJson(html);
    });

    it('should render human-readable cards when hardDisqualifiers in BidDecision contains nested arrays', () => {
      const decision: BidDecision = {
        bidId: 'bid-adv-999',
        verdict: 'DO_NOT_PURSUE',
        evaluatedAt: '2026-10-15T10:00:00Z',
        evaluatedFactors: 10,
        reasons: ['Turnover deficit and blacklisting.'],
        hardDisqualifiers: [
          ['Turnover shortfall of ₹68.10 Cr', 'Debarred from railway works'],
          [{ title: 'Safety Audit Failure', reason: 'Zero rating on safety compliance' }],
        ],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision,
        }),
      );

      expect(html).toContain('Turnover shortfall of ₹68.10 Cr');
      expect(html).toContain('Debarred from railway works');
      expect(html).toContain('Safety Audit Failure');
      // Must not render an empty card container while declaring Hard Disqualifiers count
      expect(html).not.toMatch(/<div class="flex flex-col gap-2\.5"><\/div>/);
      assertZeroRawJson(html);
    });
  });

  describe('5. Hostile Strings Containing Raw Braces, XML, or Code Snippets', () => {
    it('should handle string with colon prefix and embedded JSON object without leaking braces or raw JSON', () => {
      const payload = 'Notice: { "status": "DISQUALIFIED", "reason": "Debarred by NHAI" }';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Debarred by NHAI');
      assertZeroRawJson(html);
    });

    it('should handle hostile string with curly braces and code snippets cleanly', () => {
      const payload =
        'Evaluation Fault: function check() { if (turnover < 350) return { disqualified: true }; }';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      assertZeroRawJson(html);
    });

    it('should handle XML tags and serialized markup gracefully', () => {
      const payload =
        '<disqualification><title>Solvency Deficit</title><reason>Bank letter missing</reason></disqualification>';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Solvency Deficit');
      expect(html).toContain('Bank letter missing');
      assertZeroRawJson(html);
    });
  });

  describe('6. BidVerdictCard Full Integration with Hostile Decision Payloads', () => {
    it('should render the full BidVerdictCard with zero raw JSON syntax across all sections', () => {
      const hostileDecision: BidDecision = {
        bidId: 'bid-adv-999',
        verdict: 'DO_NOT_PURSUE',
        evaluatedAt: '2026-10-15T10:00:00Z',
        evaluatedFactors: 15,
        reasons: [
          '```json\n{"summary": "Overall evaluation indicates mandatory disqualification"}\n```',
          'Notice: { "turnover": "Deficit of ₹50 Cr" }',
        ],
        reasonsNotToPursue: [
          '{"factor": "FINANCIAL", "detail": "Turnover is under threshold"}',
        ],
        hardDisqualifiers: [
          '```json\n{"requirement_title": "Turnover Threshold", "reason": "Short by 50 Cr", "shortfall_detail": "50 Cr", "clause_reference": "4.1"}\n```',
          '{\n  "requirement_title": "Debarment",\n  "reason": "Debarred by state PWD",\n}',
          JSON.stringify(JSON.stringify({ title: 'Double Stringified', reason: 'License lapsed' })),
        ],
        commercialRisks: [
          '{"category": "LIQUIDATED_DAMAGES", "summary": "1% per week penalty", "level": "HIGH"}',
        ],
        evidenceCitations: [
          '```json\n{"title": "Audited Balance Sheet", "document_name": "Audit.pdf", "page_number": 12, "notes": "Audited UDIN verified"}\n```',
        ],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision: hostileDecision,
        }),
      );

      assertZeroRawJson(html);
    });
  });
});
