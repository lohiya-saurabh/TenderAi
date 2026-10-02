import { TenderDocument } from '../domain/entities/TenderDocument.js';
import { IStorageService } from './IStorageService.js';
import {
  DocumentContentNormalizer,
  NormalizedDocumentPage,
} from './DocumentContentNormalizer.js';
import {
  IDocumentExtractor,
  ExtractedComplianceItem,
} from './IngestionWorker.js';
import { SecurityContextDto } from '@tenderpulse/shared-types';

export interface RawExtractedItem {
  category?: string;
  title?: string;
  description?: string;
  executionRules?: {
    stampPaperRequired?: boolean;
    stampPaperDenominationInr?: number;
    notarizationRequired?: boolean;
    udinRequired?: boolean;
    signingAuthorityRank?: string;
  };
  provenance?: {
    pageNumber?: number;
    clauseReference?: string;
    verbatimQuote?: string;
    confidenceScore?: number;
  };
}

export interface AiServiceExtractResponse {
  bid_id?: string;
  document_id?: string;
  status?: string;
  items?: RawExtractedItem[];
}

export interface AiExtractorConfig {
  aiBaseUrl?: string;
  internalServiceKey?: string;
  timeoutMs?: number;
  customFetch?: (
    url: string,
    init: RequestInit
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<AiServiceExtractResponse> }>;
}

export class AiDocumentExtractor implements IDocumentExtractor {
  private readonly aiBaseUrl: string;
  private readonly internalServiceKey: string;
  private readonly timeoutMs: number;
  private readonly customFetch?: (
    url: string,
    init: RequestInit
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<AiServiceExtractResponse> }>;

  constructor(
    private readonly storageService: IStorageService,
    private readonly normalizer: DocumentContentNormalizer = new DocumentContentNormalizer(),
    config: AiExtractorConfig = {}
  ) {
    this.aiBaseUrl = config.aiBaseUrl ?? process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    this.internalServiceKey =
      config.internalServiceKey ??
      process.env.INTERNAL_SERVICE_KEY ??
      'tenderpulse-internal-secret-2026';
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.customFetch = config.customFetch;
  }

  public async extract(
    document: TenderDocument,
    securityContext?: SecurityContextDto
  ): Promise<ExtractedComplianceItem[]> {
    // 1. Fetch document blob from S3 using tenant-scoped object key
    const rawContent = await this.storageService.getObject(document.s3Key);
    if (!rawContent) {
      throw new Error(
        `Failed to retrieve document content for key '${document.s3Key}'. Object not found in storage.`
      );
    }

    // 2. Normalize content into pages
    const pages: NormalizedDocumentPage[] = this.normalizer.normalize(rawContent);

    // 3. Fallback or verify SecurityContext
    const secCtx: SecurityContextDto = securityContext ?? {
      tenantId: document.organizationId,
      userId: 'system-worker',
      roles: ['ADMIN'],
      workflowRunId: `run-${document.id}-${Date.now()}`,
      allowedDocumentIds: [document.id],
      allowedSourceIds: ['s3_vault'],
      purpose: 'COMPLIANCE_EXTRACTION',
    };

    // 4. Dispatch request to FastAPI AI Engine
    const payload = {
      security_context: {
        tenant_id: secCtx.tenantId,
        user_id: secCtx.userId,
        workflow_run_id: secCtx.workflowRunId,
        allowed_document_ids: secCtx.allowedDocumentIds,
        allowed_source_ids: secCtx.allowedSourceIds,
        purpose: secCtx.purpose,
      },
      bid_id: document.bidId,
      document_id: document.id,
      document_type: document.documentType,
      file_name: document.fileName,
      pages: pages.map((p) => ({
        page_number: p.pageNumber,
        text: p.text,
      })),
    };

    const fetchFn = this.customFetch ?? globalThis.fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetchFn(`${this.aiBaseUrl}/api/v1/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Key': this.internalServiceKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `AI extraction service returned HTTP ${response.status} for document '${document.id}'.`
        );
      }

      const data = await response.json();
      const rawItems = data.items ?? [];

      // 5. Deterministic validation of extracted items structure
      return rawItems.map((item: RawExtractedItem, idx: number): ExtractedComplianceItem => {
        if (!item.category || typeof item.category !== 'string') {
          throw new Error(`Extracted item at index ${idx} is missing a valid category.`);
        }
        if (!item.title || typeof item.title !== 'string') {
          throw new Error(`Extracted item at index ${idx} is missing a valid title.`);
        }
        if (!item.provenance || !item.provenance.verbatimQuote) {
          throw new Error(`Extracted item at index ${idx} lacks deterministic provenance quote.`);
        }

        return {
          category: item.category,
          title: item.title,
          description: item.description ?? '',
          executionRules: {
            stampPaperRequired: Boolean(item.executionRules?.stampPaperRequired),
            stampPaperDenominationInr: item.executionRules?.stampPaperDenominationInr ?? undefined,
            notarizationRequired: Boolean(item.executionRules?.notarizationRequired),
            udinRequired: Boolean(item.executionRules?.udinRequired),
            signingAuthorityRank: item.executionRules?.signingAuthorityRank ?? 'Authorized Signatory',
          },
          provenance: {
            pageNumber: Number(item.provenance.pageNumber) || 1,
            clauseReference: item.provenance.clauseReference ?? 'NIT Clause',
            verbatimQuote: item.provenance.verbatimQuote,
            confidenceScore: Number(item.provenance.confidenceScore) || 0.95,
          },
        };
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
