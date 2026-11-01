/**
 * AiEvidenceExtractor — Client adapter for automated company evidence extraction & chunking.
 *
 * Dispatches evidence documents (balance sheets, work orders, ISO certificates)
 * to FastAPI (/api/v1/evidence/extract) for PDF text extraction via pypdfium2,
 * structured attribute extraction (UDIN, turnover, contract values, accreditation),
 * and semantic chunking for the RAG Bid/No-Bid decision engine.
 */
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';
import type { SecurityContextDto } from '@tenderpulse/shared-types';
import type { CompanyEvidenceDocument } from '@/common/database/schema.js';

export interface ExtractedEvidenceChunk {
  chunk_id?: string;
  chunk_index: number;
  chunk_type: string;
  content: string;
  page_number: number;
  clause_reference?: string;
  bounding_box?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Dense vector from the AI worker's local model; the model is named in metadata.embedding_model. */
  embedding?: number[] | null;
}

export interface AiEvidenceExtractionResult {
  evidence_document_id: string;
  organization_id: string;
  company_id: string;
  status: 'COMPLETED' | 'FAILED';
  extracted_attributes: Record<string, unknown>;
  chunks: ExtractedEvidenceChunk[];
  error?: string;
}

export interface AiEvidenceExtractorConfig {
  aiBaseUrl?: string;
  internalServiceKey?: string;
  timeoutMs?: number;
  customFetch?: typeof fetch;
  configService?: ConfigService;
}

@Injectable()
export class AiEvidenceExtractor {
  private readonly logger = new StructuredLogger(AiEvidenceExtractor.name, 'api');
  private readonly aiBaseUrl: string;
  private readonly internalServiceKey: string;
  private readonly timeoutMs: number;
  private readonly customFetch?: typeof fetch;

  constructor(
    @Optional() config: AiEvidenceExtractorConfig = {},
    @Optional() configService?: ConfigService,
  ) {
    const cs = config.configService ?? configService;
    this.aiBaseUrl = config.aiBaseUrl ?? cs?.get<string>('AI_ENGINE_URL') ?? '';
    const internalServiceKey = config.internalServiceKey ?? cs?.get<string>('INTERNAL_SERVICE_KEY');
    this.internalServiceKey = internalServiceKey ?? '';
    const rawTimeout = config.timeoutMs ?? cs?.get<string>('AI_EXTRACTION_TIMEOUT_MS');
    this.timeoutMs = rawTimeout
      ? typeof rawTimeout === 'number'
        ? rawTimeout
        : parseInt(String(rawTimeout), 10)
      : 60000;
    this.customFetch = config.customFetch;
  }

  public async extractEvidence(
    document: CompanyEvidenceDocument,
    securityContext?: SecurityContextDto,
    downloadUrl?: string,
    bufferText?: string,
  ): Promise<AiEvidenceExtractionResult> {
    const secCtx: SecurityContextDto = securityContext ?? {
      tenantId: document.organizationId,
      companyId: document.companyId,
      userId: 'system-evidence-worker',
      correlationId: `corr-ev-${document.id}`,
      roles: ['ADMIN'],
      workflowRunId: `run-ev-${document.id}-${Date.now()}`,
      allowedDocumentIds: [document.id],
      allowedSourceIds: [],
      purpose: 'COMPLIANCE_EXTRACTION',
    };

    const payload = {
      security_context: {
        tenant_id: secCtx.tenantId,
        company_id: secCtx.companyId,
        user_id: secCtx.userId,
        workflow_run_id: secCtx.workflowRunId,
        correlation_id: secCtx.correlationId,
        allowed_document_ids: secCtx.allowedDocumentIds,
        purpose: secCtx.purpose ?? 'COMPLIANCE_EXTRACTION',
      },
      organization_id: document.organizationId,
      company_id: document.companyId,
      evidence_document_id: document.id,
      file_name: document.fileName,
      evidence_type: document.evidenceType,
      download_url: downloadUrl,
      pages: bufferText ? [{ page_number: 1, text: bufferText }] : [],
    };

    const endpoint = `${this.aiBaseUrl}/api/v1/evidence/extract`;
    const fetchFn = this.customFetch ?? fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Service-Key': this.internalServiceKey,
    };
    const context = LoggingContextHolder.get();
    if (context.traceId) headers['X-Trace-Id'] = context.traceId;
    if (context.correlationId) headers['X-Correlation-Id'] = context.correlationId;

    try {
      this.logger.log(
        `Dispatching company evidence ${document.id} (${document.fileName}) to AI engine (${endpoint})...`,
      );
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI evidence extraction service returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as AiEvidenceExtractionResult;
      this.logger.log(
        `AI evidence extraction succeeded for doc ${document.id}: generated ${data.chunks?.length ?? 0} chunks.`,
      );
      return data;
    } catch (err: unknown) {
      this.logger.warn(
        `Remote AI evidence extraction failed for doc ${document.id}: ${(err as Error)?.message}. No attributes were extracted.`,
      );
      // LLM-only: no local regex extractor. Report the failure; nothing is guessed.
      return {
        evidence_document_id: document.id,
        organization_id: document.organizationId,
        company_id: document.companyId,
        status: 'FAILED',
        extracted_attributes: {},
        chunks: [],
        error: (err as Error)?.message || 'AI evidence extraction is unavailable.',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
