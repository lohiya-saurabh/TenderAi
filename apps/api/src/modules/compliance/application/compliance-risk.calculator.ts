import type * as schema from '@/common/database/schema.js';
import type { DemoComplianceItem } from '@/seed/data.js';

export interface StatutoryRiskItem {
  complianceItemId: string;
  category: string;
  title: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  financialImpactRupees: number;
  mitigationAdvice: string | null;
  clauseCitation: string | null;
  executionConstraints: string[];
}

export interface CommercialRiskItem {
  riskId?: string;
  category: string;
  title?: string;
  summary: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  mitigationAdvice?: string | null;
  source: 'BID_DECISION' | 'REQUIREMENT_MATRIX';
}

export interface RiskFindingsResult {
  bidId: string;
  tenderNumber: string;
  summary: {
    totalRisks: number;
    criticalCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    statutoryComplianceRiskCount: number;
    commercialRiskCount: number;
    estimatedFinancialExposureRupees: number;
  };
  statutoryRisks: StatutoryRiskItem[];
  commercialRisks: CommercialRiskItem[];
  hardDisqualifiers: string[];
  uncertainAreas: string[];
  reviewTriggers: string[];
  evaluatedAt: string;
}

/** What extraction records per clause that signals risk (grounded attributes + flags). */
export interface ClauseRiskSignals {
  attributes: {
    obligation_type?: string | null;
    obligationType?: string | null;
    disqualifying?: boolean | null;
    amount?: { inr?: number | null } | null;
  } | null;
  flags: string[];
}

/** Level from what the tender states; null = not a risk finding. Nothing is guessed. */
function riskFromSignals(
  signals: ClauseRiskSignals | undefined,
): { level: 'CRITICAL' | 'HIGH' | 'MEDIUM'; reason: string } | null {
  if (!signals) return null;
  const obligation = signals.attributes?.obligation_type ?? signals.attributes?.obligationType;
  if (signals.attributes?.disqualifying) {
    return {
      level: 'CRITICAL',
      reason: 'The tender states the bid is rejected if this is not met.',
    };
  }
  if (signals.flags.includes('CONFLICT')) {
    return { level: 'HIGH', reason: 'The tender states this differently in another clause.' };
  }
  if (obligation === 'PENALTY') {
    return { level: 'HIGH', reason: 'Penalty or liquidated damages clause.' };
  }
  if (obligation === 'FINANCIAL_COMMITMENT') {
    return { level: 'MEDIUM', reason: 'Financial commitment (security, guarantee or fee).' };
  }
  if (signals.flags.includes('QUOTE_NOT_FOUND') || signals.flags.includes('NEAR_FAILED_PAGE')) {
    return { level: 'MEDIUM', reason: 'Source could not be fully verified; check the page.' };
  }
  return null;
}

/**
 * Consolidates statutory constraints, execution obligations, and AI commercial risks.
 */
export function buildRiskFindings(
  bidId: string,
  tenderNumber: string,
  mappedItems: DemoComplianceItem[],
  decisionRecord?: schema.BidDecision | null,
  clauseSignals?: Map<string, ClauseRiskSignals>,
): RiskFindingsResult {
  const statutoryRisks: StatutoryRiskItem[] = [];
  let estimatedFinancialExposureRupees = 0;

  for (const item of mappedItems) {
    const rules = item.executionRules;
    const constraints: string[] = [];
    if (rules?.stampPaperRequired) {
      constraints.push(
        rules.stampPaperDenominationInr
          ? `Non-Judicial Stamp Paper of ₹${rules.stampPaperDenominationInr} required`
          : 'Non-Judicial Stamp Paper required (denomination not stated)',
      );
    }
    if (rules?.notarizationRequired) {
      constraints.push('Notarization by Notary Public / Oath Commissioner required');
    }
    if (rules?.udinRequired) {
      constraints.push('Chartered Accountant ICAI UDIN verification required');
    }
    if (rules?.signingAuthorityRank) {
      constraints.push(`Signing authority rank: ${rules.signingAuthorityRank}`);
    }

    const signals = clauseSignals?.get(item.id);
    const derived = riskFromSignals(signals);
    if (derived) {
      // Amount only when the clause itself states it (grounded attribute), never estimated.
      const stated = Number(signals?.attributes?.amount?.inr) || 0;
      estimatedFinancialExposureRupees += stated;
      statutoryRisks.push({
        complianceItemId: item.id,
        category: item.category,
        title: item.title,
        level: derived.level,
        summary: derived.reason,
        financialImpactRupees: stated,
        mitigationAdvice: item.reviewNotes || null,
        clauseCitation: item.provenance?.sectionOrClause || null,
        executionConstraints: constraints,
      });
    } else if (item.risk || item.status === 'FLAGGED' || item.status === 'FAIL') {
      const rawLevel = item.risk?.level?.toUpperCase();
      const level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
        rawLevel === 'CRITICAL' ||
        rawLevel === 'HIGH' ||
        rawLevel === 'MEDIUM' ||
        rawLevel === 'LOW'
          ? rawLevel
          : item.status === 'FAIL'
            ? 'CRITICAL'
            : 'MEDIUM';

      const impact = Number(item.risk?.financialImpactRupees) || 0;
      estimatedFinancialExposureRupees += impact;

      statutoryRisks.push({
        complianceItemId: item.id,
        category: item.category,
        title: item.title,
        level,
        summary: item.risk?.summary || item.description,
        financialImpactRupees: impact,
        mitigationAdvice: item.risk?.mitigation || item.reviewNotes || null,
        clauseCitation: item.provenance?.sectionOrClause || null,
        executionConstraints: constraints,
      });
    }
  }

  const commercialRisks: CommercialRiskItem[] = [];
  let hardDisqualifiers: string[] = [];
  let uncertainAreas: string[] = [];
  let reviewTriggers: string[] = [];

  if (decisionRecord) {
    const decisionResponse =
      typeof decisionRecord.response === 'string'
        ? JSON.parse(decisionRecord.response)
        : (decisionRecord.response as Record<string, unknown>);

    if (decisionResponse && typeof decisionResponse === 'object') {
      if (Array.isArray(decisionResponse.commercial_risks)) {
        for (const cr of decisionResponse.commercial_risks) {
          if (typeof cr === 'string') {
            commercialRisks.push({
              category: 'COMMERCIAL',
              summary: cr,
              level: 'HIGH',
              source: 'BID_DECISION',
            });
          } else if (typeof cr === 'object' && cr !== null) {
            const obj = cr as Record<string, unknown>;
            const rawLevel = String(obj.level || 'MEDIUM').toUpperCase();
            const level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
              rawLevel === 'CRITICAL' ||
              rawLevel === 'HIGH' ||
              rawLevel === 'MEDIUM' ||
              rawLevel === 'LOW'
                ? (rawLevel as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
                : 'MEDIUM';

            commercialRisks.push({
              category: String(obj.category || 'COMMERCIAL'),
              title:
                typeof obj.title === 'string'
                  ? obj.title
                  : typeof obj.risk_type === 'string'
                    ? obj.risk_type
                    : undefined,
              summary: String(obj.summary || obj.description || obj.detail || ''),
              level,
              mitigationAdvice:
                typeof obj.mitigation_advice === 'string'
                  ? obj.mitigation_advice
                  : typeof obj.mitigation === 'string'
                    ? obj.mitigation
                    : null,
              source: 'BID_DECISION',
            });
          }
        }
      }

      if (Array.isArray(decisionResponse.hard_disqualifiers)) {
        hardDisqualifiers = decisionResponse.hard_disqualifiers.map((d: unknown) =>
          typeof d === 'string' ? d : JSON.stringify(d),
        );
      }
      if (Array.isArray(decisionResponse.uncertain_areas)) {
        uncertainAreas = decisionResponse.uncertain_areas.map((u: unknown) =>
          typeof u === 'string' ? u : JSON.stringify(u),
        );
      }
      if (Array.isArray(decisionResponse.review_triggers)) {
        reviewTriggers = decisionResponse.review_triggers.map((t: unknown) =>
          typeof t === 'string' ? t : JSON.stringify(t),
        );
      }
    }
  }

  const allRisks = [...statutoryRisks, ...commercialRisks];
  const criticalCount = allRisks.filter((r) => r.level === 'CRITICAL').length;
  const highCount = allRisks.filter((r) => r.level === 'HIGH').length;
  const mediumCount = allRisks.filter((r) => r.level === 'MEDIUM').length;
  const lowCount = allRisks.filter((r) => r.level === 'LOW').length;

  return {
    bidId,
    tenderNumber,
    summary: {
      totalRisks: allRisks.length,
      criticalCount,
      highSeverityCount: highCount,
      mediumSeverityCount: mediumCount,
      lowSeverityCount: lowCount,
      statutoryComplianceRiskCount: statutoryRisks.length,
      commercialRiskCount: commercialRisks.length,
      estimatedFinancialExposureRupees,
    },
    statutoryRisks,
    commercialRisks,
    hardDisqualifiers,
    uncertainAreas,
    reviewTriggers,
    evaluatedAt: new Date().toISOString(),
  };
}
