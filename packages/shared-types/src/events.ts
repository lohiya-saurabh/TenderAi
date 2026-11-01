import type { SecurityContextDto } from './security.js';
import type { TenderDocumentChunkDto } from './chat.js';
import type {
  ClauseAttributesDto,
  ClauseFlag,
  WireConflictDto,
  WireCoverageDto,
} from './clause.js';

/**
 * One extracted clause on the wire (AI → API). `null` = not stated in the tender.
 * Mirrored by schema/extraction-completed.schema.json (validated in the AI test suite).
 */
export interface ExtractedComplianceItemDto {
  /** Location identity computed by the AI: hash(document, page, quote) */
  itemKey?: string;
  /** Reading order within the document */
  docOrder?: number;
  category: string;
  title: string;
  description?: string;
  executionRules: {
    stampPaperRequired?: boolean | null;
    stampPaperDenominationInr?: number | null;
    notarizationRequired?: boolean | null;
    udinRequired?: boolean | null;
    apostilleRequired?: boolean | null;
    clientCountersignRequired?: boolean | null;
    signingAuthorityRank?: string | null;
  };
  attributes?: ClauseAttributesDto;
  provenance: {
    sourceDocumentId?: string;
    sourceFileName?: string;
    documentId?: string;
    documentName?: string;
    pageNumber: number;
    supportingPages?: number[];
    clauseReference?: string | null;
    sourceBlockId?: string | null;
    verbatimQuote: string;
    /** Deterministic validation score (1 = every check passed); null when not computed. */
    confidenceScore?: number | null;
  };
  flags?: ClauseFlag[];
  verificationStatus?: string;
  /** Legacy (pre-Phase 1) AI payloads */
  verification_status?: string;
  is_conflict?: boolean;
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
  conflicts?: WireConflictDto[];
  coverage?: WireCoverageDto | null;
  error?: string;
  workflowRunId?: string;
  traceId?: string;
  correlationId?: string;
  timestamp?: string;
}

