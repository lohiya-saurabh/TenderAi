export type BidStatusType =
  'DRAFT' | 'QUEUED' | 'PROCESSING' | 'REVIEW_READY' | 'FINALIZED' | 'FAILED';

export interface BidSummaryDto {
  id: string;
  organizationId: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  estimatedValueFormatted: string;
  submissionDeadline: string;
  status: BidStatusType;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBidRequest {
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: string;
}
