import * as schema from '@/common/database/schema.js';

export interface TenderAmendmentItem {
  id: string;
  bidId: string;
  tenderNumber: string;
  tenderTitle: string;
  tenderingAuthority: string;
  /** The corrigendum's own number; null until it is read from the document. */
  corrigendumNumber: string | null;
  documentId: string;
  documentName: string;
  publishedAt: string;
  amendmentType:
    | 'DEADLINE_EXTENSION'
    | 'TECHNICAL_SPEC_CHANGE'
    | 'EMD_AMENDMENT'
    | 'ELIGIBILITY_REVISION'
    | 'GENERAL_CLARIFICATION'
    | 'UNCLASSIFIED';
  /** What changed; null until the corrigendum is compared with the tender. */
  summary: string | null;
  impact: {
    deadlineChanged: boolean | null;
    previousDeadline: string | null;
    revisedDeadline: string | null;
    daysExtended: number | null;
    affectedRequirementsCount: number;
    requiresReEvaluation: boolean;
  };
  status: 'PROCESSED' | 'EVALUATED' | 'REQUIRES_CONFIRMATION' | 'RECEIVED';
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

  const amendments: TenderAmendmentItem[] = filteredDocs.map((doc) => {
    const parentBid = bidsMap.get(doc.bidId);
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

    return {
      id: `amend-${doc.id}`,
      bidId: doc.bidId,
      tenderNumber: parentBid?.tenderNumber || 'N/A',
      tenderTitle: parentBid?.title || 'Tender Opportunity',
      tenderingAuthority: parentBid?.tenderingAuthority || 'Authority',
      corrigendumNumber: null,
      documentId: doc.id,
      documentName: doc.fileName,
      publishedAt,
      // Only what is known: a corrigendum document was uploaded, and which clauses it holds.
      // Its number, type and deadline change are not read from the document yet (Phase 4, A3).
      amendmentType: 'UNCLASSIFIED' as const,
      summary: null,
      impact: {
        deadlineChanged: null,
        previousDeadline: parentBid?.submissionDeadline || null,
        revisedDeadline: null,
        daysExtended: null,
        affectedRequirementsCount: affectedItems.length,
        requiresReEvaluation: affectedItems.length > 0,
      },
      status: 'RECEIVED' as const,
    };
  });

  return {
    organizationId: orgId,
    totalAmendments: amendments.length,
    unreadCount: amendments.length,
    amendments,
  };
}
