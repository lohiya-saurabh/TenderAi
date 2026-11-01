import { describe, it, expect } from 'vitest';
import {
  mapVerdict,
  mapApiDecisionToBidDecision,
  formatReasonItem,
  formatCommercialRiskItem,
  formatMissingItem,
  parseDisqualifierItem,
  formatDisqualifierItem,
  extractCleanText,
  type ApiBidDecisionSummary,
} from '@/components/bid/detail/bidDetailData.js';

describe('bidDetailData — Robust Reason & Decision Formatting', () => {
  describe('formatCommercialRiskItem', () => {
    it('should format full risk object with title, detail, and advice', () => {
      const formatted = formatCommercialRiskItem({
        title: 'Working Capital Lock-in',
        detail: '10% security deposit required for 18 months.',
        mitigationAdvice: 'Ensure dedicated overdraft limit is sanctioned.',
      });
      expect(formatted).toBe(
        'Working Capital Lock-in: 10% security deposit required for 18 months. [Ensure dedicated overdraft limit is sanctioned.]',
      );
    });

    it('should format live API risk shape with level, summary, and category without undefined', () => {
      const formatted = formatCommercialRiskItem({
        level: 'MEDIUM',
        summary: 'Standard 0.5% per week delay penalty capped at 10% of contract value.',
        category: 'LIQUIDATED_DAMAGES',
      });
      expect(formatted).toBe(
        'LIQUIDATED DAMAGES: Standard 0.5% per week delay penalty capped at 10% of contract value.',
      );
      expect(formatted).not.toContain('undefined');
    });

    it('should handle string risk', () => {
      const formatted = formatCommercialRiskItem('Severe monsoon delay penalty applies');
      expect(formatted).toBe('Severe monsoon delay penalty applies');
    });

    it('should return null for nullish input', () => {
      expect(formatCommercialRiskItem(null)).toBeNull();
      expect(formatCommercialRiskItem(undefined)).toBeNull();
    });
  });

  describe('formatReasonItem', () => {
    it('should format object with title and detail', () => {
      const formatted = formatReasonItem({
        title: 'Exceeds Turnover Threshold',
        detail: '3-Year Average Turnover of ₹281.90 Cr exceeds requirement.',
      });
      expect(formatted).toBe(
        'Exceeds Turnover Threshold: 3-Year Average Turnover of ₹281.90 Cr exceeds requirement.',
      );
    });

    it('should format string reason', () => {
      const formatted = formatReasonItem('Active ISO 9001 certification verified');
      expect(formatted).toBe('Active ISO 9001 certification verified');
    });
  });

  describe('mapApiDecisionToBidDecision', () => {
    it('should map live API payload cleanly without any undefined string artifacts', () => {
      const apiPayload: ApiBidDecisionSummary = {
        decisionId: 'bd-nhai-001',
        bidId: 'bid-nhai-44-001',
        profileVersionId: 'cpv-acme-v1',
        verdict: 'CONDITIONAL_GO',
        state: 'AI_PROPOSED',
        readinessScore: 0.865,
        evaluatedAt: '2026-10-05T15:22:08.071Z',
        reasonsToPursue: [
          {
            title: 'Exceeds Turnover Threshold',
            detail: '3-Year Average Turnover of ₹281.90 Cr exceeds the ₹150.00 Cr requirement.',
            category: 'FINANCIAL',
          },
          {
            title: 'Strong Similar Work Experience',
            detail:
              'Largest completed project of ₹215.00 Cr qualifies against the ₹120.00 Cr threshold.',
            category: 'TECHNICAL',
          },
          {
            title: 'Integrated ISO Certifications',
            detail: 'Maintains 4 active quality & environmental management certifications.',
            category: 'STATUTORY',
          },
        ],
        reasonsNotToPursue: [],
        hardDisqualifiers: [],
        missingInformation: [],
        uncertainAreas: [
          {
            clauseReference: 'Clause 4.1',
            ambiguityType: 'AMBIGUOUS_PLANT',
            quote: 'Sensor paver required',
            recommendedClarification: 'Clarify if leased units qualify',
          },
        ],
        commercialRisks: [
          {
            title: '',
            severity: '',
            category: 'LIQUIDATED_DAMAGES',
            detail: '',
            mitigationAdvice: '',
            level: 'MEDIUM',
            summary: 'Standard 0.5% per week delay penalty capped at 10% of contract value.',
          } as unknown as NonNullable<ApiBidDecisionSummary['commercialRisks']>[number],
        ],
        evidenceCitations: [],
        reviewTriggers: [],
      };

      const decision = mapApiDecisionToBidDecision(apiPayload);

      expect(decision.verdict).toBe('REVIEW_REQUIRED');
      expect(decision.readinessScore).toBe(0.865);
      expect(decision.reasons.length).toBe(5);

      decision.reasons.forEach((reason) => {
        expect(reason).not.toContain('undefined');
      });

      expect(decision.reasons).toContain(
        'Exceeds Turnover Threshold: 3-Year Average Turnover of ₹281.90 Cr exceeds the ₹150.00 Cr requirement.',
      );
      expect(decision.reasons).toContain(
        'LIQUIDATED DAMAGES: Standard 0.5% per week delay penalty capped at 10% of contract value.',
      );
    });
  });

  describe('mapVerdict — Resilient Mapping', () => {
    it('should map standard and legacy verdict strings properly', () => {
      expect(mapVerdict('GO')).toBe('PURSUE');
      expect(mapVerdict('CONDITIONAL_GO')).toBe('PURSUE');
      expect(mapVerdict('PROCEED_WITH_CAUTION')).toBe('PURSUE');
      expect(mapVerdict('PURSUE')).toBe('PURSUE');
      expect(mapVerdict('NO_GO')).toBe('DO_NOT_PURSUE');
      expect(mapVerdict('DO_NOT_PURSUE')).toBe('DO_NOT_PURSUE');
      expect(mapVerdict('REVIEW_REQUIRED')).toBe('REVIEW_REQUIRED');
      expect(mapVerdict(null)).toBe('RECOMMENDATION_UNAVAILABLE');
      expect(mapVerdict(undefined)).toBe('RECOMMENDATION_UNAVAILABLE');
      expect(mapVerdict('RECOMMENDATION_UNAVAILABLE')).toBe('RECOMMENDATION_UNAVAILABLE');
      expect(mapVerdict('INSUFFICIENT_DATA')).toBe('RECOMMENDATION_UNAVAILABLE');
    });
  });

  describe('parseDisqualifierItem & formatDisqualifierItem — No Raw JSON', () => {
    it('should parse structured object with snake_case fields from AiDecisionClient', () => {
      const parsed = parseDisqualifierItem({
        requirement_title: 'Annual Financial Turnover',
        reason: 'Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.',
        clause_reference: 'Clause 4.1 Financial Eligibility',
        shortfall_detail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
      });

      expect(parsed).toEqual({
        title: 'Annual Financial Turnover',
        reason: 'Turnover deficit: company average is ₹281.90 Cr vs required ₹350.00 Cr.',
        clauseReference: 'Clause 4.1 Financial Eligibility',
        shortfallDetail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
        factor: undefined,
      });

      const formatted = formatDisqualifierItem({
        requirement_title: 'Annual Financial Turnover',
        reason: 'Turnover deficit',
        shortfall_detail: 'Required: ₹350 Cr | Found: ₹281 Cr',
      });
      expect(formatted).toBe('Annual Financial Turnover: Turnover deficit (Required: ₹350 Cr | Found: ₹281 Cr)');
      expect(formatted).not.toContain('{');
      expect(formatted).not.toContain('}');
    });

    it('should parse camelCase object with factor tag', () => {
      const parsed = parseDisqualifierItem({
        title: 'Similar Work Experience',
        reason: 'Completed project value ₹180 Cr falls short of ₹220 Cr threshold.',
        shortfallDetail: 'Shortfall: ₹40.00 Cr',
        clauseReference: 'Section III - 4.2',
        factor: 'TECHNICAL',
      });

      expect(parsed).toEqual({
        title: 'Similar Work Experience',
        reason: 'Completed project value ₹180 Cr falls short of ₹220 Cr threshold.',
        shortfallDetail: 'Shortfall: ₹40.00 Cr',
        clauseReference: 'Section III - 4.2',
        factor: 'TECHNICAL',
      });
    });

    it('should parse stringified JSON strings into clean structured items with zero raw JSON leakage', () => {
      const jsonString = JSON.stringify({
        requirement_title: 'Net Worth Requirement',
        reason: 'Net worth is negative in FY 2023-24',
        shortfall_detail: 'Negative net worth of -₹12.4 Cr',
        clause_reference: 'Clause 3.1.2',
      });

      const parsed = parseDisqualifierItem(jsonString);
      expect(parsed).toEqual({
        title: 'Net Worth Requirement',
        reason: 'Net worth is negative in FY 2023-24',
        shortfallDetail: 'Negative net worth of -₹12.4 Cr',
        clauseReference: 'Clause 3.1.2',
        factor: undefined,
      });

      const formatted = formatDisqualifierItem(jsonString);
      expect(formatted).toBe('Net Worth Requirement: Net worth is negative in FY 2023-24 (Negative net worth of -₹12.4 Cr)');
      expect(formatted).not.toContain('{');
      expect(formatted).not.toContain('}');
    });

    it('should parse plain string with colon title into title and reason', () => {
      const parsed = parseDisqualifierItem('Debarment Status: Contractor is currently debarred by MoRTH');
      expect(parsed).toEqual({
        title: 'Debarment Status',
        reason: 'Contractor is currently debarred by MoRTH',
        shortfallDetail: undefined,
        clauseReference: undefined,
        factor: undefined,
      });
    });

    it('should parse plain string without colon using default title', () => {
      const parsed = parseDisqualifierItem('Contractor has active litigation exceeding 25% of net worth');
      expect(parsed).toEqual({
        title: 'Disqualification Risk',
        reason: 'Contractor has active litigation exceeding 25% of net worth',
        shortfallDetail: undefined,
        clauseReference: undefined,
        factor: undefined,
      });
    });

    it('should return null for null, undefined, empty string, or invalid types', () => {
      expect(parseDisqualifierItem(null)).toBeNull();
      expect(parseDisqualifierItem(undefined)).toBeNull();
      expect(parseDisqualifierItem('')).toBeNull();
      expect(parseDisqualifierItem('   ')).toBeNull();
      expect(parseDisqualifierItem([])).toBeNull();
      expect(formatDisqualifierItem(null)).toBeNull();
      expect(formatDisqualifierItem(undefined)).toBeNull();
      expect(formatDisqualifierItem('')).toBeNull();
    });

    it('should normalize nested object shortfall pairs into clean human text without [object Object]', () => {
      const parsed = parseDisqualifierItem({
        title: 'Turnover Deficit',
        reason: '3-year average turnover below threshold',
        shortfall_detail: {
          required: '₹350.00 Cr',
          found: '₹281.90 Cr',
        },
        category: 'FINANCIAL',
      });

      expect(parsed).toEqual({
        title: 'Turnover Deficit',
        reason: '3-year average turnover below threshold',
        shortfallDetail: 'Required: ₹350.00 Cr | Found: ₹281.90 Cr',
        clauseReference: undefined,
        factor: 'FINANCIAL',
      });
    });

    it('should parse double-quoted JSON string safely', () => {
      const doubleQuoted = JSON.stringify(
        JSON.stringify({
          title: 'Debarment Risk',
          reason: 'Firm is barred by state PWD',
        }),
      );

      const parsed = parseDisqualifierItem(doubleQuoted);
      expect(parsed?.title).toBe('Debarment Risk');
      expect(parsed?.reason).toBe('Firm is barred by state PWD');
      expect(parsed?.reason).not.toContain('{');
    });
  });

  describe('extractCleanText — Zero Raw JSON & Zero [object Object]', () => {
    it('should extract plain string directly', () => {
      expect(extractCleanText('Valid Tax Clearance')).toBe('Valid Tax Clearance');
    });

    it('should parse and extract stringified JSON without brackets or raw syntax', () => {
      const text = extractCleanText(
        JSON.stringify({ reason: 'Bank guarantee expired on 2026-04-10' }),
      );
      expect(text).toBe('Bank guarantee expired on 2026-04-10');
      expect(text).not.toContain('{');
      expect(text).not.toContain('}');
    });

    it('should extract structured object with required/found into clean readable pair', () => {
      const text = extractCleanText({ required: '100 km highway', actual: '45 km highway' });
      expect(text).toBe('Required: 100 km highway | Found: 45 km highway');
      expect(text).not.toContain('[object Object]');
    });

    it('should return empty string for null, undefined, and empty objects', () => {
      expect(extractCleanText(null)).toBe('');
      expect(extractCleanText(undefined)).toBe('');
      expect(extractCleanText({})).toBe('');
    });
  });

  describe('formatReasonItem & formatMissingItem — Defensive Stringified JSON Handling', () => {
    it('should format stringified JSON reason into human readable text without raw JSON syntax', () => {
      const jsonReason = JSON.stringify({
        title: 'Net Worth Criterion',
        detail: 'Audited net worth of ₹120 Cr satisfies requirements',
      });
      const formatted = formatReasonItem(jsonReason);
      expect(formatted).toBe('Net Worth Criterion: Audited net worth of ₹120 Cr satisfies requirements');
      expect(formatted).not.toContain('{');
      expect(formatted).not.toContain('}');
    });

    it('should format stringified JSON missing item cleanly', () => {
      const jsonMissing = JSON.stringify({
        title: 'GST Clearance Certificate',
        missing_factor: 'No active GST certificate uploaded',
        suggested_action: 'Upload Form GSTR-3B for Q3',
      });
      const formatted = formatMissingItem(jsonMissing);
      expect(formatted).toBe(
        'GST Clearance Certificate: No active GST certificate uploaded — Upload Form GSTR-3B for Q3',
      );
      expect(formatted).not.toContain('{');
    });

    it('should format stringified JSON commercial risk cleanly', () => {
      const jsonRisk = JSON.stringify({
        title: 'Mobilization Delay',
        detail: 'Penalty of 1% per week',
        mitigation_advice: 'Establish site office 14 days in advance',
      });
      const formatted = formatCommercialRiskItem(jsonRisk);
      expect(formatted).toBe('Mobilization Delay: Penalty of 1% per week [Establish site office 14 days in advance]');
      expect(formatted).not.toContain('{');
    });
  });
});
