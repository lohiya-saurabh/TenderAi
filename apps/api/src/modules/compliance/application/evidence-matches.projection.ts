import type { DemoComplianceItem } from '@/seed/data.js';

export interface EvidenceMatchItem {
  complianceItemId: string;
  category: string;
  requirementTitle: string;
  description: string;
  status: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'EXPIRED';
  tenderCitation: DemoComplianceItem['provenance'];
  companyEvidence: DemoComplianceItem['companyEvidence'];
  executionRules: DemoComplianceItem['executionRules'];
}

export interface EvidenceMatchesResult {
  bidId: string;
  totalRequirements: number;
  totalMatched: number;
  totalPartial: number;
  totalUnmatched: number;
  coveragePct: number;
  matches: EvidenceMatchItem[];
}

/**
 * Projects compliance requirements against company evidence documents to determine matching status.
 */
export function buildEvidenceMatches(
  bidId: string,
  items: DemoComplianceItem[],
): EvidenceMatchesResult {
  const matches: EvidenceMatchItem[] = items.map((item) => {
    const hasEvidence = !!item.companyEvidence && !!item.companyEvidence.id;
    let matchStatus: 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'EXPIRED' = 'UNMATCHED';

    if (hasEvidence) {
      if (item.companyEvidence?.status === 'EXPIRED') {
        matchStatus = 'EXPIRED';
      } else if (item.companyEvidence?.status === 'MISSING') {
        matchStatus = 'UNMATCHED';
      } else if (
        item.companyEvidence?.status === 'SELF_ATTESTED' ||
        item.status === 'REVIEW_REQUIRED' ||
        item.humanReviewRequired
      ) {
        matchStatus = 'PARTIAL';
      } else {
        matchStatus = 'MATCHED';
      }
    }

    return {
      complianceItemId: item.id,
      category: item.category,
      requirementTitle: item.title,
      description: item.description,
      status: item.status,
      matchStatus,
      tenderCitation: item.provenance,
      companyEvidence: item.companyEvidence,
      executionRules: item.executionRules,
    };
  });

  const totalMatched = matches.filter((m) => m.matchStatus === 'MATCHED').length;
  const totalPartial = matches.filter((m) => m.matchStatus === 'PARTIAL').length;
  const totalUnmatched = matches.filter(
    (m) => m.matchStatus === 'UNMATCHED' || m.matchStatus === 'EXPIRED',
  ).length;

  return {
    bidId,
    totalRequirements: matches.length,
    totalMatched,
    totalPartial,
    totalUnmatched,
    coveragePct:
      matches.length > 0
        ? Math.round(((totalMatched + totalPartial * 0.5) / matches.length) * 100)
        : 0,
    matches,
  };
}
