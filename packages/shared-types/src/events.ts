import type { SecurityContextDto } from './security.js';
import type { TenderDocumentChunkDto } from './chat.js';

export interface ExtractedComplianceItemDto {
  category: string;
  title: string;
  description?: string;
  executionRules: {
    stampPaperRequired?: boolean;
    stampPaperDenominationInr?: number | null;
    notarizationRequired?: boolean;
    udinRequired?: boolean;
    signingAuthorityRank?: string;
  };
  provenance: {
    sourceDocumentId?: string;
    sourceFileName?: string;
    documentId?: string;
    documentName?: string;
    pageNumber: number;
    clauseReference?: string;
    verbatimQuote: string;
    confidenceScore?: number;
  };
}

export interface DocumentIngestionCommand {
  jobId: string;
  organizationId: string;
  companyId?: string;
  bidId: string;
  documentId: string;
  storageReference?: string;
  downloadUrl?: string;
  documentType?: string;
  fileName?: string;
  workflowRunId?: string;
  traceId?: string;
  correlationId?: string;
  securityContext?: SecurityContextDto;
  asyncMode?: boolean;
  timestamp?: string;
}

export interface DocumentExtractionCompletedEvent {
  jobId: string;
  organizationId: string;
  companyId?: string;
  bidId: string;
  documentId: string;
  status: 'COMPLETED' | 'FAILED' | 'REVIEW_READY' | string;
  items: ExtractedComplianceItemDto[];
  chunks?: TenderDocumentChunkDto[];
  error?: string;
  workflowRunId?: string;
  traceId?: string;
  correlationId?: string;
  timestamp?: string;
}

