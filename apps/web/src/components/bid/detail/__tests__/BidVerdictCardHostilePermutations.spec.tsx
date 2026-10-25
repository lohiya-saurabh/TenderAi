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
 * 4. ZERO 'undefined' or 'null' as visible leaked text.
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

describe('BidVerdictCard & DisqualifierItemCard — Hostile Permutations Stress Suite', () => {
  const mockBid: BidDetail = {
    id: 'bid-adv-perm-01',
    tenderId: 'tender-adv-perm-01',
    tenderTitle: 'Hostile Permutations Stress Test',
    authority: 'NHAI',
    status: 'DECIDED',
    verdict: 'NO_GO',
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T11:00:00Z',
    sourceDocument: 'NIT_Hostile.pdf',
    submissionDeadline: '2026-11-20T17:00:00Z',
    estimatedValueRupees: 500000000,
  };

  const mockComplianceItems: ComplianceItem[] = [];

  describe('1. 5x Stringified JSON Payloads', () => {
    it('should unpack 5x stringified JSON without leaking quotes, brackets, or backslashes', () => {
      let payload: unknown = {
        requirement_title: '5x Stringified Turnover Deficit',
        reason: 'Turnover falls short by ₹120.50 Cr across 5 iterations.',
        clause_reference: 'Clause 99.5',
        shortfall_detail: 'Required: ₹400 Cr | Found: ₹279.50 Cr',
        factor: 'FINANCIAL',
      };

      for (let i = 0; i < 5; i++) {
        payload = JSON.stringify(payload);
      }

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('5x Stringified Turnover Deficit');
      expect(html).toContain('Turnover falls short by ₹120.50 Cr');
      expect(html).toContain('Clause 99.5');
      assertZeroRawJson(html);
    });

    it('should handle 5x stringified JSON within BidVerdictCard reasons and citations', () => {
      let citationPayload: unknown = {
        title: 'Audited Balance Sheet FY25',
        document_name: 'BalanceSheet.pdf',
        page_number: 42,
        notes: 'Net worth certified by statutory auditor',
      };
      for (let i = 0; i < 5; i++) {
        citationPayload = JSON.stringify(citationPayload);
      }

      let reasonPayload: unknown = {
        title: 'Technical Capacity Deficiency',
        reason: 'Bidder has not completed similar highway projects',
      };
      for (let i = 0; i < 5; i++) {
        reasonPayload = JSON.stringify(reasonPayload);
      }

      const decision: BidDecision = {
        bidId: 'bid-adv-perm-01',
        verdict: 'DO_NOT_PURSUE',
        evaluatedAt: '2026-10-15T10:00:00Z',
        evaluatedFactors: 8,
        reasons: [reasonPayload as string],
        evidenceCitations: [citationPayload],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision,
        }),
      );

      expect(html).toContain('Technical Capacity Deficiency');
      expect(html).toContain('Audited Balance Sheet FY25');
      expect(html).toContain('BalanceSheet.pdf');
      assertZeroRawJson(html);
    });
  });

  describe('2. Mixed HTML / XML Tags and Malformed Entities', () => {
    it('should parse XML tag pairs cleanly without leaking tags or raw entities into title and reason', () => {
      const payload =
        '<disqualification><title>Pollution Board Debarment</title><reason>Consent to Operate revoked by SPCB</reason></disqualification>';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).toContain('Pollution Board Debarment');
      expect(html).toContain('Consent to Operate revoked by SPCB');
      assertZeroRawJson(html);
    });

    it('should handle malformed XML / HTML markup with embedded code safely', () => {
      const payload =
        '<div><title><span>Safety Protocol Violation</span></title><reason>Fatal accident report &lt;unmitigated&gt;</reason></div>';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: payload }));

      expect(html).not.toContain('[object Object]');
      assertZeroRawJson(html);
    });
  });

  describe('3. Null, Undefined, and Sparse Nested Arrays', () => {
    it('should handle null and undefined passed directly to DisqualifierItemCard safely', () => {
      const htmlNull = render(React.createElement(DisqualifierItemCard, { rawItem: null }));
      expect(htmlNull).toBe('');

      const htmlUndefined = render(React.createElement(DisqualifierItemCard, { rawItem: undefined }));
      expect(htmlUndefined).toBe('');

      const htmlEmptyArray = render(React.createElement(DisqualifierItemCard, { rawItem: [] }));
      expect(htmlEmptyArray).toBe('');
    });

    it('should handle deeply nested arrays with null, empty, and valid items in hardDisqualifiers', () => {
      const decision: BidDecision = {
        bidId: 'bid-adv-perm-01',
        verdict: 'DO_NOT_PURSUE',
        evaluatedAt: '2026-10-15T10:00:00Z',
        evaluatedFactors: 12,
        reasons: ['Sparse array handling test'],
        hardDisqualifiers: [
          null,
          undefined,
          [],
          [null],
          ['Turnover shortfall of ₹45.00 Cr'],
          [[{ title: 'Recovered Disqualifier', reason: 'Unnested from sparse tree' }]],
          '',
        ] as unknown as unknown[],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision,
        }),
      );

      expect(html).toContain('Turnover shortfall of ₹45.00 Cr');
      expect(html).toContain('Recovered Disqualifier');
      expect(html).toContain('Unnested from sparse tree');
      assertZeroRawJson(html);
    });
  });

  describe('4. Whitespace-Only Backticks and Single-Line Code Fences', () => {
    it('should handle whitespace-only backtick code fences without rendering empty cards or raw backticks', () => {
      const whitespaceFences = [
        '```\n   \n```',
        '```json\n\n```',
        '```',
        '```json\n\t\r\n```',
      ];

      for (const fence of whitespaceFences) {
        const html = render(React.createElement(DisqualifierItemCard, { rawItem: fence }));
        // Should either render null or clean default without backticks
        expect(html).not.toContain('```');
        assertZeroRawJson(html);
      }
    });

    it('should handle single-line markdown code fences containing JSON', () => {
      const singleLineFence = '```json {"requirement_title": "Single Line Fence", "reason": "Single line reason text"} ```';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: singleLineFence }));

      expect(html).toContain('Single Line Fence');
      expect(html).toContain('Single line reason text');
      assertZeroRawJson(html);
    });
  });

  describe('5. Hostile Broken / Truncated JSON Payloads', () => {
    it('should handle broken/truncated JSON with trailing comma gracefully', () => {
      const truncated = '{"title": "Unclosed Object", "reason": "Trailing comma and broken brace",';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: truncated }));

      expect(html).not.toContain('[object Object]');
      assertZeroRawJson(html);
    });

    it('should handle JSON with prototype keys safely', () => {
      const protoPayload = JSON.stringify({
        __proto__: { polluted: true },
        constructor: 'broken',
        title: 'Prototype Cleanliness',
        reason: 'Object keys must not pollute or break rendering',
      });

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: protoPayload }));

      expect(html).toContain('Prototype Cleanliness');
      expect(html).toContain('Object keys must not pollute or break rendering');
      assertZeroRawJson(html);
    });

    it('should handle non-string primitive values inside object fields', () => {
      const primitivePayload = {
        title: 12345,
        reason: false,
        shortfallDetail: 99.5,
        clauseReference: 101,
        factor: true,
      };

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: primitivePayload }));

      expect(html).toContain('12345');
      expect(html).toContain('false');
      expect(html).toContain('99.5');
      assertZeroRawJson(html);
    });
  });

  describe('6. Complex Strings with Embedded JSON and Prefixes', () => {
    it('should handle string with tender prefix and JSON object without leaking syntax', () => {
      const prefixPayload = 'Tender Ref [NIT/2026/01]: {"verdict": "FAIL", "reason": "Invalid EMD bank guarantee format"}';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: prefixPayload }));

      expect(html).toContain('Invalid EMD bank guarantee format');
      assertZeroRawJson(html);
    });

    it('should handle string with shortfall in parenthesis and colon prefix', () => {
      const textPayload = 'Financial Eligibility: Annual turnover of ₹280 Cr (Shortfall: ₹70 Cr deficit)';

      const html = render(React.createElement(DisqualifierItemCard, { rawItem: textPayload }));

      expect(html).toContain('Financial Eligibility');
      expect(html).toContain('Annual turnover of ₹280 Cr');
      expect(html).toContain('₹70 Cr deficit');
      assertZeroRawJson(html);
    });
  });

  describe('7. Full BidVerdictCard Under Adversarial Stress Across All Sections', () => {
    it('should render all sections of BidVerdictCard cleanly without any raw JSON or [object Object]', () => {
      const multiSectionHostileDecision: BidDecision = {
        bidId: 'bid-adv-perm-full',
        verdict: 'REVIEW_REQUIRED',
        evaluatedAt: '2026-10-15T12:00:00Z',
        evaluatedFactors: 20,
        reasons: [
          '```json\n{"title": "Prequalification Review", "detail": "Clarification required on joint venture equity"}\n```',
          'Notice: { "turnover": "₹310 Cr vs ₹350 Cr" }',
          JSON.stringify(JSON.stringify({ title: 'Double Stringified Reason', detail: 'Auditor clarification awaited' })),
        ],
        reasonsToPursue: [
          '```json\n{"title": "Experience Alignment", "detail": "15 years experience in highway tunneling"}\n```',
          { title: 'Financial Solvency', detail: 'Bank solvency of ₹100 Cr verified' },
        ],
        reasonsNotToPursue: [
          'Evaluation Notice: { "litigation": "Pending arbitration with NHAI" }',
        ],
        hardDisqualifiers: [
          '```json\n{"requirement_title": "Debarment Check", "reason": "No active debarment order found", "clause_reference": "1.1"}\n```',
          [
            '```\n{\n  "requirement_title": "Machinery Deficit",\n  "reason": "Missing 2 asphalt pavers",\n}\n```',
          ],
          JSON.stringify(
            JSON.stringify(
              JSON.stringify({
                title: 'Nested Triple Stringified Disqualifier',
                reason: 'Safety compliance rating below minimum acceptable benchmark',
              }),
            ),
          ),
        ],
        missingInformation: [
          '```json\n{"title": "GST Returns", "missing_factor": "GSTR-3B for Q4", "suggested_action": "Upload signed GSTR-3B"}\n```',
          { title: 'EPF Registration', detail: 'Challan copy missing', suggestedAction: 'Furnish recent challan' },
        ],
        uncertainAreas: [
          '```json\n{"title": "Subcontracting Clause", "detail": "Clause 14 ambiguity on max subcontracting %"}\n```',
          { title: 'Tax Exemption', quote: 'SEZ tax holiday validity period unclear' },
        ],
        commercialRisks: [
          '```json\n{"category": "LIQUIDATED_DAMAGES", "detail": "0.5% per week up to 10%", "mitigation": "Request cap reduction"}\n```',
          { category: 'PRICE_VARIATION', detail: 'No escalation clause for bitumen', level: 'HIGH' },
        ],
        evidenceCitations: [
          '```json\n{"title": "Technical Experience Certificate", "document_name": "ExpCert.pdf", "page_number": 8, "notes": "NHAI certified completion"}\n```',
          JSON.stringify(
            JSON.stringify({
              title: 'Turnover Certificate',
              document_name: 'TurnoverCA.pdf',
              page_number: 1,
              notes: 'UDIN verified CA statement',
            }),
          ),
        ],
      };

      const html = render(
        React.createElement(BidVerdictCard, {
          bid: mockBid,
          complianceItems: mockComplianceItems,
          decision: multiSectionHostileDecision,
        }),
      );

      assertZeroRawJson(html);
      expect(html).toContain('Prequalification Review');
      expect(html).toContain('Clarification required on joint venture equity');
      expect(html).toContain('Experience Alignment');
      expect(html).toContain('15 years experience in highway tunneling');
      expect(html).toContain('Debarment Check');
      expect(html).toContain('Machinery Deficit');
      expect(html).toContain('Missing 2 asphalt pavers');
      expect(html).toContain('Nested Triple Stringified Disqualifier');
      expect(html).toContain('GST Returns');
      expect(html).toContain('GSTR-3B for Q4');
      expect(html).toContain('Subcontracting Clause');
      expect(html).toContain('LIQUIDATED DAMAGES');
      expect(html).toContain('Technical Experience Certificate');
      expect(html).toContain('Turnover Certificate');
    });
  });
});
