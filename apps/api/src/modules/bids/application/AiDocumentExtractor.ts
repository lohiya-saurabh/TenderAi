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
export type { ExtractedComplianceItem };
import { StructuredLogger } from '../../../common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '../../../common/logging/LoggingContext.js';
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

export type ExtractableDocument = Pick<
  TenderDocument,
  'id' | 'bidId' | 'organizationId' | 'documentType' | 'fileName' | 'storagePath'
>;

export interface DispatchExtractionResult {
  dispatched: boolean;
  status: string;
  jobId: string;
  documentId: string;
}

export interface DocumentExtractionPort {
  dispatchExtraction(
    document: ExtractableDocument,
    securityContext?: SecurityContextDto,
  ): Promise<DispatchExtractionResult>;
  extract?(
    document: ExtractableDocument,
    securityContext?: SecurityContextDto,
  ): Promise<ExtractedComplianceItem[]>;
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

export class AiDocumentExtractor implements IDocumentExtractor, DocumentExtractionPort {
  private readonly logger = new StructuredLogger(AiDocumentExtractor.name, 'api');
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
    const internalServiceKey = config.internalServiceKey ?? process.env.INTERNAL_SERVICE_KEY;
    if (!internalServiceKey && process.env.NODE_ENV === 'production') {
      throw new Error('INTERNAL_SERVICE_KEY must be configured in production.');
    }
    this.internalServiceKey = internalServiceKey ?? 'tenderpulse-internal-secret-2026';
    this.timeoutMs = config.timeoutMs ?? (process.env.AI_EXTRACTION_TIMEOUT_MS ? parseInt(process.env.AI_EXTRACTION_TIMEOUT_MS, 10) : 120000);
    this.customFetch = config.customFetch;
  }

  public async extract(
    document: ExtractableDocument,
    securityContext?: SecurityContextDto
  ): Promise<ExtractedComplianceItem[]> {
    if (!this.customFetch) {
      throw new Error(
        `Synchronous extraction via AiDocumentExtractor.extract() is disabled. Ingestion must use dispatchExtraction() for asynchronous queue/event choreography.`
      );
    }

    // 1. Verify object existence in storage (metadata check, avoiding loading full blob into memory)
    let exists = true;
    try {
      const head = await this.storageService.headObject(document.storagePath);
      exists = head.exists;
    } catch {
      const raw = await this.storageService.getObject(document.storagePath);
      exists = Boolean(raw);
    }

    if (!exists) {
      throw new Error(
        `Failed to retrieve document content for key '${document.storagePath}'. Object not found in storage.`
      );
    }

    // 2. Prepare Security Context
    const secCtx: SecurityContextDto = securityContext ?? {
      tenantId: document.organizationId,
      userId: 'system-worker',
      correlationId: `corr-${document.id}`,
      roles: ['ADMIN'],
      workflowRunId: `run-${document.id}-${Date.now()}`,
      allowedDocumentIds: [document.id],
      allowedSourceIds: ['s3_vault'],
      purpose: 'COMPLIANCE_EXTRACTION',
    };

    // 3. Handover Pattern: Generate presigned download URL for direct Python / Docling / PDFium ingestion
    let downloadUrl: string | undefined;
    try {
      downloadUrl = await this.storageService.generatePresignedDownloadUrl(
        document.storagePath,
        document.fileName,
        900 // 15-minute lease
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to generate presigned download URL for doc ${document.id}: ${(err as Error)?.message}. Falling back to inline buffer normalization.`
      );
    }

    let candidatePages: NormalizedDocumentPage[] = [];

    // 5. Dispatch request to FastAPI AI Engine
    const payload = {
      job_id: `job-${document.id}`,
      organization_id: secCtx.tenantId,
      company_id: secCtx.companyId,
      bid_id: document.bidId,
      document_id: document.id,
      workflow_run_id: secCtx.workflowRunId,
      correlation_id: secCtx.correlationId,
      storage_reference: document.storagePath,
      document_type: document.documentType,
      file_name: document.fileName,
      download_url: downloadUrl,
      async_mode: false,
      security_context: {
        tenant_id: secCtx.tenantId,
        user_id: secCtx.userId,
        company_id: secCtx.companyId,
        workflow_run_id: secCtx.workflowRunId,
        correlation_id: secCtx.correlationId,
        allowed_document_ids: secCtx.allowedDocumentIds,
        allowed_source_ids: secCtx.allowedSourceIds,
        purpose: secCtx.purpose,
      },
      pages: candidatePages.map((p) => ({
        page_number: p.pageNumber,
        text: p.text,
      })),
    };

    const fetchFn = this.customFetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const endpoint = `${this.aiBaseUrl}/api/v1/extract`;

    this.logger.log(
      `Dispatching document ${document.id} to AI engine (${endpoint}) via ${downloadUrl ? 'presigned URL handover' : `${candidatePages.length} locally extracted pages`
      }...`,
    );

    const context = LoggingContextHolder.get();
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Service-Key': this.internalServiceKey,
    };
    if (context.traceId) requestHeaders['X-Trace-Id'] = context.traceId;
    if (context.correlationId) requestHeaders['X-Correlation-Id'] = context.correlationId;
    if (context.requestId) requestHeaders['X-Request-Id'] = context.requestId;

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: requestHeaders,
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
      this.logger.log(
        `AI extraction service responded with ${rawItems.length} raw compliance items for doc ${document.id}.`,
      );

      // 6. Deterministic validation of extracted items structure
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

  public async dispatchExtraction(
    document: ExtractableDocument,
    securityContext?: SecurityContextDto,
  ): Promise<DispatchExtractionResult> {
    let exists = true;
    try {
      const head = await this.storageService.headObject(document.storagePath);
      exists = head.exists;
    } catch {
      const raw = await this.storageService.getObject(document.storagePath);
      exists = Boolean(raw);
    }

    if (!exists) {
      throw new Error(
        `Failed to retrieve document content for key '${document.storagePath}'. Object not found in storage.`
      );
    }

    const secCtx: SecurityContextDto = securityContext ?? {
      tenantId: document.organizationId,
      userId: 'system-worker',
      correlationId: `corr-${document.id}`,
      roles: ['ADMIN'],
      workflowRunId: `run-${document.id}-${Date.now()}`,
      allowedDocumentIds: [document.id],
      allowedSourceIds: ['s3_vault'],
      purpose: 'COMPLIANCE_EXTRACTION',
    };

    let downloadUrl: string | undefined;
    try {
      downloadUrl = await this.storageService.generatePresignedDownloadUrl(
        document.storagePath,
        document.fileName,
        900,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to generate presigned download URL for doc ${document.id}: ${(err as Error)?.message}`,
      );
    }

    const isMockStorage = Boolean(
      downloadUrl?.includes('mock-s3.tenderpulse.local') ||
      downloadUrl?.includes('.local') ||
      downloadUrl?.includes('localhost:4566') ||
      downloadUrl?.includes('127.0.0.1:4566')
    );
    let candidatePages: NormalizedDocumentPage[] = [];
    if (!downloadUrl || isMockStorage) {
      candidatePages = await this.extractCandidatePagesLocally(document);
    }

    const jobId = `job-${document.id}-${Date.now()}`;
    const payload = {
      job_id: jobId,
      organization_id: secCtx.tenantId,
      company_id: secCtx.companyId,
      bid_id: document.bidId,
      document_id: document.id,
      workflow_run_id: secCtx.workflowRunId,
      correlation_id: secCtx.correlationId,
      storage_reference: document.storagePath,
      document_type: document.documentType,
      file_name: document.fileName,
      download_url: downloadUrl,
      async_mode: true,
      security_context: {
        tenant_id: secCtx.tenantId,
        user_id: secCtx.userId,
        company_id: secCtx.companyId,
        workflow_run_id: secCtx.workflowRunId,
        correlation_id: secCtx.correlationId,
        allowed_document_ids: secCtx.allowedDocumentIds,
        allowed_source_ids: secCtx.allowedSourceIds,
        purpose: secCtx.purpose,
      },
      pages: candidatePages.map((p) => ({
        page_number: p.pageNumber,
        text: p.text,
      })),
    };

    const fetchFn = this.customFetch ?? globalThis.fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    this.logger.log(
      `Dispatching asynchronous extraction command for doc ${document.id} to ${this.aiBaseUrl}/api/v1/worker/process-message`,
    );

    const context = LoggingContextHolder.get();
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Service-Key': this.internalServiceKey,
    };
    if (context.traceId) requestHeaders['X-Trace-Id'] = context.traceId;
    if (context.correlationId) requestHeaders['X-Correlation-Id'] = context.correlationId;
    if (context.requestId) requestHeaders['X-Request-Id'] = context.requestId;

    try {
      const response = await fetchFn(`${this.aiBaseUrl}/api/v1/worker/process-message`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `AI worker service returned HTTP ${response.status} for async dispatch.`,
        );
      }

      const data = await response.json();
      return {
        dispatched: true,
        status: data.status ?? 'ACCEPTED',
        jobId,
        documentId: document.id,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async extractCandidatePagesLocally(
    document: ExtractableDocument
  ): Promise<NormalizedDocumentPage[]> {
    const rawContent = await this.storageService.getObject(document.storagePath);
    if (!rawContent) {
      throw new Error(
        `Failed to retrieve document content for key '${document.storagePath}'. Object not found in storage.`
      );
    }

    const allPages: NormalizedDocumentPage[] = await this.normalizer.normalize(rawContent);
    this.logger.debug(
      `Retrieved storage object for doc ${document.id}. Normalized ${allPages.length} total pages.`,
    );

    const isPureTocPage = (text: string): boolean => {
      if (!text || text.trim().length === 0) return true;
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) return true;

      const textLower = text.toLowerCase();
      const isTocTitle =
        textLower.includes('table of contents') ||
        textLower.includes('contents') ||
        textLower.includes('index of clauses') ||
        textLower.includes('brief contents');

      let tocLines = 0;
      for (const line of lines) {
        if (
          /\.{3,}|\u2026|\s+\d+$/.test(line) ||
          /^(section|clause|chapter|part)\s+[\dIVXLCDM]+/i.test(line)
        ) {
          tocLines++;
        }
      }

      const tocRatio = tocLines / lines.length;
      const hasOperative = /\b(shall|must|is required to|will be forfeited|undertakes to)\b/i.test(text);

      if (isTocTitle && tocRatio > 0.2 && !hasOperative) return true;
      if (tocRatio > 0.5 && !hasOperative) return true;
      return false;
    };

    if (allPages.length > 30) {
      const initialPages = allPages.slice(0, 10).filter((p) => !isPureTocPage(p.text));
      const remainingPages = allPages.slice(10);

      const procurementKeywords = [
        'earnest money',
        'emd',
        'bid security',
        'tender security',
        'performance security',
        'performance bank guarantee',
        'pbg',
        'bank guarantee',
        'power of attorney',
        'consortium',
        'joint venture',
        'jv agreement',
        'board resolution',
        'authorized signatory',
        'annual turnover',
        'net worth',
        'financial capacity',
        'solvency',
        'working capital',
        'similar work',
        'past experience',
        'technical capacity',
        'technical experience',
        'personnel',
        'key expert',
        'project manager',
        'equipment',
        'machinery',
        'plant and equipment',
        'validity of bids',
        'bid validity',
        'period of validity',
        'liquidated damages',
        'delay damages',
        'defect liability',
        'litigation',
        'debarment',
        'blacklisting',
        'integrity pact',
        'conflict of interest',
        'stamp',
        'notary',
        'udin',
        'local content',
        'make in india',
        'ppp-mii',
        'gst',
        'gstin',
        'taxes and duties',
        // Contract Execution & Concession Agreement covenants
        'conditions precedent',
        'project milestone',
        'completion schedule',
        'schedule-g',
        'schedule g',
        'scheduled completion date',
        'commercial operation date',
        'completion date',
        'cod',
        'applicable permits',
        'schedule-e',
        'schedule e',
        'maintenance criteria',
        'maintenance manual',
        'schedule-k',
        'schedule k',
        'rectification',
        'pothole',
        'rescue post',
        'mobile crane',
        'ambulance',
        'medical aid',
        'construction support',
        'grant',
        'escrow account',
        'priority of payments',
        'co-insured',
        'all-risk',
        'sarod',
        'dispute resolution',
        'arbitration',
        'conciliation',
        'change of scope',
        'weigh-in-motion',
        'location tracking',
        'fatality',
        'grievous injury',
      ];

      const scoredPages: { page: NormalizedDocumentPage; score: number }[] = [];
      for (const p of remainingPages) {
        if (isPureTocPage(p.text)) continue;
        const textLower = p.text.toLowerCase();
        let score = 0;
        for (const kw of procurementKeywords) {
          if (textLower.includes(kw)) {
            score++;
          }
        }
        if (score > 0) {
          scoredPages.push({ page: p, score });
        }
      }

      scoredPages.sort((a, b) => b.score - a.score);
      const topScored = scoredPages.slice(0, 75).map((s) => s.page);

      const combinedMap = new Map<number, NormalizedDocumentPage>();
      for (const p of initialPages) {
        combinedMap.set(p.pageNumber, p);
      }
      for (const p of topScored) {
        combinedMap.set(p.pageNumber, p);
      }

      return Array.from(combinedMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
    } else {
      const nonTocPages = allPages.filter((p) => !isPureTocPage(p.text));
      return nonTocPages.length > 0 ? nonTocPages : allPages;
    }
  }
}
