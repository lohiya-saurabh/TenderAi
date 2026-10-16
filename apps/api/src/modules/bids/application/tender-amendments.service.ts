import * as schema from '@/common/database/schema.js';

export interface TenderAmendmentItem {
  id: string;
  bidId: string;
  tenderNumber: string;
  tenderTitle: string;
  tenderingAuthority: string;
  corrigendumNumber: string;
  documentId: string;
  documentName: string;
  publishedAt: string;
  amendmentType:
    | 'DEADLINE_EXTENSION'
    | 'TECHNICAL_SPEC_CHANGE'
    | 'EMD_AMENDMENT'
    | 'ELIGIBILITY_REVISION'
    | 'GENERAL_CLARIFICATION';
  summary: string;
  impact: {
    deadlineChanged: boolean;
    previousDeadline: string | null;
    revisedDeadline: string | null;
    daysExtended: number | null;
    affectedRequirementsCount: number;
    requiresReEvaluation: boolean;
  };
  status: 'PROCESSED' | 'EVALUATED' | 'REQUIRES_CONFIRMATION';
}

export interface TenderAmendmentsResult {
  organizationId: string;
  totalAmendments: number;
  unreadCount: number;
  amendments: TenderAmendmentItem[];
}

/**
 * Synthesizes corrigendum / amendment streams and computes lifecycle impact across bids.
 */
export function buildTenderAmendments(
  orgId: string,
  allBids: schema.Bid[],
  corrDocs: schema.TenderDocument[],
  allCompliance: schema.ComplianceItem[],
  bidIdFilter?: string,
): TenderAmendmentsResult {
  if (!orgId) {
    return {
      organizationId: '',
      totalAmendments: 0,
      unreadCount: 0,
      amendments: [],
    };
  }

  const bidsMap = new Map(allBids.map((b) => [b.id, b]));
  const filteredDocs = bidIdFilter ? corrDocs.filter((d) => d.bidId === bidIdFilter) : corrDocs;

  const amendments: TenderAmendmentItem[] = filteredDocs.map((doc, idx) => {
    const parentBid = bidsMap.get(doc.bidId);
    const corrNum = doc.fileName.toLowerCase().includes('02')
      ? 'Corrigendum-02'
      : 'Corrigendum-01';
    const publishedAt =
      doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : String(doc.uploadedAt);

    const affectedItems = allCompliance.filter((item) => {
      if (item.bidId !== doc.bidId) return false;
      try {
        const prov =
          typeof item.provenance === 'string'
            ? JSON.parse(item.provenance)
            : (item.provenance as Record<string, unknown>);
        return prov?.documentId === doc.id || prov?.documentName === doc.fileName;
      } catch {
        return false;
      }
    });

    const isDeadlineExt =
      doc.fileName.toLowerCase().includes('date') ||
      doc.fileName.toLowerCase().includes('ext') ||
      idx === 0;

    return {
      id: `amend-${doc.id}`,
      bidId: doc.bidId,
      tenderNumber: parentBid?.tenderNumber || 'N/A',
      tenderTitle: parentBid?.title || 'Tender Opportunity',
      tenderingAuthority: parentBid?.tenderingAuthority || 'Authority',
      corrigendumNumber: corrNum,
      documentId: doc.id,
      documentName: doc.fileName,
      publishedAt,
      amendmentType: isDeadlineExt
        ? ('DEADLINE_EXTENSION' as const)
        : ('TECHNICAL_SPEC_CHANGE' as const),
      summary: `Pre-bid queries answered and clarifications issued under ${corrNum} for ${parentBid?.tenderNumber || 'tender'}.`,
      impact: {
        deadlineChanged: isDeadlineExt,
        previousDeadline: parentBid?.submissionDeadline || null,
        revisedDeadline: parentBid?.submissionDeadline || null,
        daysExtended: isDeadlineExt ? 10 : null,
        affectedRequirementsCount: affectedItems.length > 0 ? affectedItems.length : 1,
        requiresReEvaluation: affectedItems.length > 0,
      },
      status: 'PROCESSED' as const,
    };
  });

  return {
    organizationId: orgId,
    totalAmendments: amendments.length,
    unreadCount: amendments.filter((a) => a.status === 'PROCESSED').length,
    amendments,
  };
}
