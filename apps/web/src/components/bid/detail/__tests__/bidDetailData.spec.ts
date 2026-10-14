import { describe, it, expect } from 'vitest';
import {
  mapVerdict,
  mapApiDecisionToBidDecision,
  formatReasonItem,
  formatCommercialRiskItem,
  type ApiBidDecisionSummary,
} from '../bidDetailData.js';

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
});
