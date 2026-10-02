export type ComplianceCategoryType =
  | 'ANNEXURE_DECLARATION'
  | 'FINANCIAL_CRITERIA'
  | 'TECHNICAL_EXPERIENCE'
  | 'STATUTORY_REGISTRATION'
  | 'COMMERCIAL_RISK';

export type ComplianceStatusType = 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';

export interface ExecutionRulesDto {
  stampPaperRequired: boolean;
  stampPaperDenominationInr: number;
  notarizationRequired: boolean;
  signingAuthorityRank: string;
  udinRequired: boolean;
}

export interface ProvenanceDto {
  sourceDocumentId: string;
  sourceFileName: string;
  pageNumber: number;
  clauseReference: string;
  verbatimQuote: string;
  confidenceScore: number;
}

export interface ComplianceItemDto {
  id: string;
  bidId: string;
  organizationId: string;
  category: ComplianceCategoryType;
  title: string;
  description: string;
  executionRules: ExecutionRulesDto;
  provenance: ProvenanceDto;
  status: ComplianceStatusType;
  userNotes: string | null;
  assignedUserId: string | null;
  version: number;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateComplianceItemRequest {
  status: ComplianceStatusType;
  notes?: string | null;
  expectedVersion: number;
}
