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
        `Remote AI evidence extraction failed for doc ${document.id}: ${(err as Error)?.message}. Using local deterministic extraction fallback.`,
      );
      return this.extractEvidenceLocal(document, bufferText);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Deterministic in-process fallback extractor for offline test suites and high-availability fallback.
   */
  public extractEvidenceLocal(
    document: CompanyEvidenceDocument,
    bufferText?: string,
  ): AiEvidenceExtractionResult {
    const text = bufferText ?? `${document.fileName} ${document.evidenceType} ${document.issuer ?? ''} ${document.referenceNumber ?? ''}`;
    const extractedAttributes: Record<string, unknown> = {
      evidence_category: document.evidenceType,
    };
    const chunks: ExtractedEvidenceChunk[] = [];

    const evidenceType = (document.evidenceType || 'OTHER').toUpperCase();

    if (
      evidenceType.includes('BALANCE_SHEET') ||
      evidenceType.includes('TURNOVER') ||
      /turnover|udin|chartered accountant/i.test(text)
    ) {
      // 1. UDIN extraction
      const udinMatch = text.match(/\b([0-9]{2}[0-9A-Z]{6}[A-Z]{6}[0-9]{4}|[0-9A-Z]{18})\b/i);
      if (udinMatch && udinMatch[1]) {
        extractedAttributes.udin = udinMatch[1].toUpperCase();
        extractedAttributes.reference_number = extractedAttributes.udin;
      }

      // 2. Turnover numbers
      const avgMatch = text.match(/average(?:\s*annual)?\s*turnover[^\d]*?(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
      if (avgMatch && avgMatch[1]) {
        extractedAttributes.average_turnover_inr_cr = parseFloat(avgMatch[1]);
      }

      const turnoverMatch = text.match(/(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
      if (turnoverMatch && turnoverMatch[1]) {
        const val = parseFloat(turnoverMatch[1]);
        extractedAttributes.latest_turnover_inr_cr = val;
        if (!extractedAttributes.average_turnover_inr_cr) {
          extractedAttributes.average_turnover_inr_cr = val;
        }
      }

      chunks.push({
        chunk_index: 0,
        chunk_type: 'FINANCIAL_TURNOVER',
        content: `Statutory Financial Audit Certificate (${document.fileName})\n${extractedAttributes.udin ? `UDIN: ${extractedAttributes.udin}\n` : ''}${extractedAttributes.average_turnover_inr_cr ? `Average Turnover: INR ${extractedAttributes.average_turnover_inr_cr} Crores\n` : ''}${text}`,
        page_number: 1,
        clause_reference: 'CA Turnover Certificate (Page 1)',
        metadata: {
          file_name: document.fileName,
          fileName: document.fileName,
          evidence_document_id: document.id,
          evidenceDocumentId: document.id,
          udin: extractedAttributes.udin,
          average_turnover_cr: extractedAttributes.average_turnover_inr_cr,
        },
      });
    } else if (
      evidenceType.includes('WORK_ORDER') ||
      evidenceType.includes('COMPLETION') ||
      /completion|contract value|similar work/i.test(text)
    ) {
      const clientMatch = text.match(
        /\b(National Highways Authority of India|NHAI|Central Public Works Department|CPWD|Public Works Department|PWD|Indian Railways|RVNL|DFCCIL|MMRDA|MahaMetro)\b/i,
      );
      if (clientMatch && clientMatch[1]) {
        let matched = clientMatch[1].trim();
        if (/national highways authority of india/i.test(matched)) {
          matched = 'NHAI';
        } else if (/central public works department/i.test(matched)) {
          matched = 'CPWD';
        } else if (/public works department/i.test(matched)) {
          matched = 'PWD';
        }
        extractedAttributes.client = matched;
        extractedAttributes.client_name = matched;
        extractedAttributes.issuer = matched;
      }

      const valMatch = text.match(/(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
      if (valMatch && valMatch[1]) {
        extractedAttributes.contract_value_inr_cr = parseFloat(valMatch[1]);
      }

      chunks.push({
        chunk_index: 0,
        chunk_type: 'PROJECT_EXPERIENCE',
        content: `Project Completion Certificate (${document.fileName})\n${extractedAttributes.client_name ? `Client: ${extractedAttributes.client_name}\n` : ''}${extractedAttributes.contract_value_inr_cr ? `Completed Value: INR ${extractedAttributes.contract_value_inr_cr} Crores\n` : ''}${text}`,
        page_number: 1,
        clause_reference: 'Project Completion Certificate (Page 1)',
        metadata: {
          file_name: document.fileName,
          fileName: document.fileName,
          evidence_document_id: document.id,
          evidenceDocumentId: document.id,
          client: extractedAttributes.client_name,
          contract_value_cr: extractedAttributes.contract_value_inr_cr,
        },
      });
    } else if (
      evidenceType.includes('ISO') ||
      evidenceType.includes('ACCREDITATION') ||
      /iso\s*\d{4,5}/i.test(text)
    ) {
      const isoMatch = text.match(/\b(ISO\s*(?:9001|14001|45001|27001)(?::\d{4})?)\b/i);
      if (isoMatch && isoMatch[1]) {
        extractedAttributes.standard = isoMatch[1].toUpperCase();
      }
      const issuerMatch = text.match(/\b(Bureau Veritas|BSI|TUV|DNV|SGS|Intertek)\b/i);
      if (issuerMatch && issuerMatch[1]) {
        extractedAttributes.issuer = issuerMatch[1];
      }

      chunks.push({
        chunk_index: 0,
        chunk_type: 'CERTIFICATION',
        content: `Statutory Quality Accreditation (${document.fileName})\n${extractedAttributes.standard ? `Standard: ${extractedAttributes.standard}\n` : ''}${extractedAttributes.issuer ? `Registrar: ${extractedAttributes.issuer}\n` : ''}${text}`,
        page_number: 1,
        clause_reference: 'Accreditation Certificate (Page 1)',
        metadata: {
          standard: extractedAttributes.standard,
          issuer: extractedAttributes.issuer,
        },
      });
    } else {
      chunks.push({
        chunk_index: 0,
        chunk_type: 'GENERAL',
        content: `Company Evidence Document (${document.fileName})\nType: ${document.evidenceType}\n${text}`,
        page_number: 1,
        clause_reference: 'Document Content (Page 1)',
        metadata: { fileName: document.fileName },
      });
    }

    return {
      evidence_document_id: document.id,
      organization_id: document.organizationId,
      company_id: document.companyId,
      status: 'COMPLETED',
      extracted_attributes: extractedAttributes,
      chunks,
    };
  }
}
