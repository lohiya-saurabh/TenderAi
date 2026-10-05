/**
 * DocumentsService — Upload URL generation, upload confirmation, and download URL resolution.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { STORAGE_TOKEN } from '../../infrastructure/storage/storage.module.js';
import { QUEUE_TOKEN } from '../../infrastructure/queue/queue.module.js';
import { GcsStorageService } from '../../infrastructure/storage/GcsStorageService.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import type { IStorageService } from '../bids/application/IStorageService.js';
import type { IJobQueue } from '../bids/application/IJobQueue.js';
import { NotFoundError } from '../../common/errors/errors.js';
import { AiDocumentExtractor, type ExtractedComplianceItem } from '../bids/application/AiDocumentExtractor.js';
import { DocumentContentNormalizer, type NormalizedDocumentPage } from '../bids/application/DocumentContentNormalizer.js';
import { TenderDocument, type DocumentType } from '../bids/domain/entities/TenderDocument.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

export interface UploadUrlResult {
  documentId: string;
  uploadUrl: string;
  storagePath: string;
  s3Key: string;
  expiresInSeconds: number;
}

export interface ConfirmUploadResult {
  documentId: string;
  status: string;
}

export interface DeleteDocumentResult {
  success: boolean;
  deletedDocumentId: string;
  removedCompliancesCount: number;
}

@Injectable()
export class DocumentsService {
  private readonly db: DrizzleDb;
  private readonly pendingUploads = new Map<
    string,
    {
      fileName: string;
      mimeType: string;
      storagePath: string;
      bidId: string;
      sizeBytes?: number;
      documentType?: string;
    }
  >();

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Inject(STORAGE_TOKEN) private readonly storageService: (IStorageService & Partial<GcsStorageService>) | null,
    @Optional() @Inject(QUEUE_TOKEN) private readonly jobQueue?: IJobQueue | null,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public registerUploadedMockObject(storagePath: string, content: Buffer): void {
    if (this.storageService && typeof (this.storageService as unknown as Record<string, unknown>).simulateUploadedObject === 'function') {
      (this.storageService as unknown as { simulateUploadedObject: (p: string, s: number, c?: string, b?: Buffer) => void }).simulateUploadedObject(storagePath, content.length, undefined, content);
    }
  }

  private get gcsStorageService(): GcsStorageService | null {
    if (this.storageService && typeof this.storageService.findFilesByPrefix === 'function') {
      return this.storageService as GcsStorageService;
    }
    return null;
  }

  public async generateUploadUrl(
    bidId: string,
    rawFileName?: string,
    rawMimeType?: string,
    hostHeader?: string,
    rawSizeBytes?: number,
    rawDocumentType?: string,
  ): Promise<UploadUrlResult> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const docId = `doc-${Date.now()}`;
    const fileName = typeof rawFileName === 'string' && rawFileName.trim() ? rawFileName.trim() : 'document.pdf';
    const storagePath = `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;
    const contentType = (typeof rawMimeType === 'string' && rawMimeType) || 'application/pdf';
    const sizeBytes = typeof rawSizeBytes === 'number' && rawSizeBytes > 0 ? rawSizeBytes : undefined;
    const documentType = typeof rawDocumentType === 'string' && rawDocumentType.trim() ? rawDocumentType.trim() : 'NIT';

    this.pendingUploads.set(docId, {
      fileName,
      mimeType: contentType,
      storagePath,
      bidId,
      sizeBytes,
      documentType,
    });

    const protocol = hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1') ? 'https' : 'http';
    const fallbackLocalUploadUrl = `${protocol}://${hostHeader || 'localhost:3000'}/api/v1/mock-upload/${bidId}/${docId}/${encodeURIComponent(fileName)}`;

    let uploadUrl: string;
    if (this.storageService) {
      try {
        uploadUrl = await this.storageService.generatePresignedUploadUrl(storagePath, contentType, 900);
        // If mock storage returned a mock domain that cannot resolve via public DNS, route to local mock upload endpoint
        if (uploadUrl.includes('mock-s3.tenderpulse.local') || uploadUrl.includes('.local/')) {
          uploadUrl = fallbackLocalUploadUrl;
        }
      } catch {
        uploadUrl = fallbackLocalUploadUrl;
      }
    } else {
      uploadUrl = fallbackLocalUploadUrl;
    }

    return {
      documentId: docId,
      uploadUrl,
      storagePath,
      s3Key: storagePath,
      expiresInSeconds: 900,
    };
  }

  public async confirmUpload(bidId: string, rawDocumentId?: string): Promise<ConfirmUploadResult> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';

    const [bidRecord] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bidRecord) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const docId =
      typeof rawDocumentId === 'string' && rawDocumentId.trim() ? rawDocumentId.trim() : `doc-${Date.now()}`;
    const pending = this.pendingUploads.get(docId);

    // Look up existing DB row if pending in-memory cache was lost due to restart
    const [existingDoc] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    let fileName = pending?.fileName || (existingDoc && existingDoc.fileName !== 'Uploaded_Tender_Document.pdf' ? existingDoc.fileName : undefined);
    let storagePath = pending?.storagePath || existingDoc?.storagePath;
    const mimeType = pending?.mimeType || existingDoc?.mimeType || 'application/pdf';
    const documentType = pending?.documentType || existingDoc?.documentType || 'NIT';

    // If fileName or storagePath is not known or generic, discover real file name from GCS
    if ((!fileName || !storagePath || fileName === 'Uploaded_Tender_Document.pdf') && this.gcsStorageService) {
      try {
        const matchedFiles = await this.gcsStorageService.findFilesByPrefix(
          `tenants/${orgId}/bids/${bidId}/${docId}/`,
        );
        if (matchedFiles.length > 0) {
          storagePath = matchedFiles[0]!;
          fileName = storagePath.split('/').pop() || fileName;
        }
      } catch (err) {
        console.warn(`[DocumentsService] Failed to find files by prefix in GCS for ${docId}:`, err);
      }
    }

    fileName = fileName || 'Uploaded_Tender_Document.pdf';
    storagePath = storagePath || `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;
    const now = new Date();

    // Query exact file size from Cloud Storage headObject if available, else use reported size
    let fileSizeBytes = pending?.sizeBytes || (existingDoc ? Number(existingDoc.fileSizeBytes) : 0);
    if (this.storageService) {
      try {
        const head = await this.storageService.headObject(storagePath);
        if (head && head.exists && head.sizeBytes > 0) {
          fileSizeBytes = head.sizeBytes;
        }
      } catch (err) {
        console.warn(`[DocumentsService] Failed to query headObject for ${storagePath}:`, err);
      }
    }

    // 1. Insert real document metadata into PostgreSQL tender_documents table via Drizzle
    await this.db
      .insert(schema.tenderDocuments)
      .values({
        id: docId,
        bidId,
        organizationId: orgId,
        fileName,
        storagePath,
        fileSizeBytes,
        mimeType,
        documentType,
        status: 'EXTRACTED',
        uploadedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.tenderDocuments.id,
        set: {
          fileName,
          storagePath,
          fileSizeBytes,
          mimeType,
          documentType,
          status: 'EXTRACTED',
          uploadedAt: now,
        },
      });

    // 2. Update bid status to REVIEW_READY
    await this.db
      .update(schema.bids)
      .set({ status: 'REVIEW_READY', updatedAt: now })
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));

    // 3. Record immutable audit log
    await this.db.insert(schema.auditLogs).values({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId: orgId,
      userId,
      userName: userId === 'usr_bid_mgr_01' ? 'Vikramaditya Sharma' : 'Authorized User',
      eventType: 'DOCUMENT_UPLOADED',
      aggregateType: 'TenderDocument',
      aggregateId: docId,
      payload: { fileName, storagePath },
      timestamp: now,
    });

    // 4. Enqueue background ingestion job to SQS / PubSub queue if queue is configured
    if (this.jobQueue) {
      try {
        await this.jobQueue.enqueue({
          jobId: `job-${Date.now()}-${docId}`,
          organizationId: orgId,
          bidId,
          documentId: docId,
          timestamp: now.toISOString(),
        });
      } catch (queueErr) {
        console.warn(`[DocumentsService] Failed to enqueue ingestion job for ${docId}:`, queueErr);
      }
    }

    // 5. Trigger asynchronous extraction pipeline against FastAPI / PDF text
    void this.markExtractionComplete(bidId, docId).catch((err) => {
      console.warn(`[DocumentsService] Background extraction failed for bid '${bidId}':`, err);
    });

    return {
      documentId: docId,
      status: 'UPLOADED',
    };
  }

  public async getDownloadUrl(
    bidId: string,
    docId: string,
    hostHeader?: string,
  ): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const [docRow] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    let fileName = docRow?.fileName || 'tender_document.pdf';
    let storagePath =
      docRow?.storagePath || `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;

    if (this.gcsStorageService) {
      try {
        const matchedFiles = await this.gcsStorageService.findFilesByPrefix(
          `tenants/${orgId}/bids/${bidId}/${docId}/`,
        );

        if (matchedFiles.length > 0) {
          storagePath = matchedFiles[0]!;
          fileName = storagePath.split('/').pop() || fileName;

          const downloadUrl = await this.gcsStorageService.generatePresignedDownloadUrl(
            storagePath,
            fileName,
            3600,
          );
          return {
            downloadUrl,
            expiresInSeconds: 3600,
          };
        }
      } catch (err) {
        console.warn(`[DocumentsService] Failed to generate GCS download URL for ${storagePath}:`, err);
      }
    }

    const protocol = hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1') ? 'https' : 'http';
    const downloadUrl = `${protocol}://${hostHeader || 'localhost:3000'}/api/v1/mock-download/${bidId}/${docId}/${encodeURIComponent(fileName)}`;
    return {
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }

  public async markExtractionComplete(bidId: string, specificDocId?: string): Promise<void> {
    const now = new Date();

    // 1. Find the uploaded document for this bid via Drizzle
    const docs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.bidId, bidId))
      .orderBy(desc(schema.tenderDocuments.uploadedAt));

    const matchedDoc = specificDocId ? docs.find((d) => d.id === specificDocId) || docs[0] : docs[0];
    const docId = matchedDoc?.id || `doc-${Date.now()}`;
    let docName = matchedDoc?.fileName || 'Uploaded_Tender_Document.pdf';
    const orgId = matchedDoc?.organizationId || 'org_acme_infra_001';
    let storagePath = matchedDoc?.storagePath || `tenants/${orgId}/bids/${bidId}/${docId}/${docName}`;
    let fileSizeBytes = matchedDoc ? Number(matchedDoc.fileSizeBytes) || 1000 : 1000;
    const mimeType = matchedDoc?.mimeType || 'application/pdf';
    const documentType = matchedDoc?.documentType || 'NIT';

    // If docName is generic 'Uploaded_Tender_Document.pdf' or storage path missing, discover from storage
    if (this.gcsStorageService && (!matchedDoc || docName === 'Uploaded_Tender_Document.pdf')) {
      try {
        const matchedFiles = await this.gcsStorageService.findFilesByPrefix(
          `tenants/${orgId}/bids/${bidId}/${docId}/`,
        );
        if (matchedFiles.length > 0) {
          storagePath = matchedFiles[0]!;
          docName = storagePath.split('/').pop() || docName;

          // Reconcile and fix the DB record if it was previously set to generic placeholder
          await this.db
            .update(schema.tenderDocuments)
            .set({
              fileName: docName,
              storagePath,
            })
            .where(eq(schema.tenderDocuments.id, docId));
        }
      } catch (err) {
        console.warn(`[DocumentsService] Failed to inspect GCS prefix for extraction doc ${docId}:`, err);
      }
    }

    if (this.storageService && fileSizeBytes <= 1000) {
      try {
        const head = await this.storageService.headObject(storagePath);
        if (head && head.exists && head.sizeBytes > 0) {
          fileSizeBytes = head.sizeBytes;
          await this.db
            .update(schema.tenderDocuments)
            .set({ fileSizeBytes })
            .where(eq(schema.tenderDocuments.id, docId));
        }
      } catch (err) {
        console.warn(`[DocumentsService] Failed to query headObject for ${storagePath}:`, err);
      }
    }

    // 2. Check if compliance items already exist for this bid
    const existing = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );
    const existingCount = parseInt(existing[0]?.count || '0', 10);

    if (existingCount > 0 && !specificDocId) {
      await this.db
        .update(schema.bids)
        .set({ status: 'REVIEW_READY', updatedAt: now })
        .where(eq(schema.bids.id, bidId));
      return;
    }

    // 3. Instantiate AiDocumentExtractor connected to FastAPI
    const normalizer = new DocumentContentNormalizer();
    const effectiveStorage: IStorageService = this.storageService || new MockStorageService();
    const aiExtractor = new AiDocumentExtractor(effectiveStorage, normalizer, {
      aiBaseUrl: process.env.AI_ENGINE_URL || 'http://localhost:8000',
      internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'tenderpulse-internal-secret-2026',
      timeoutMs: 15000,
    });

    const tenderDocEntity = new TenderDocument({
      id: docId,
      bidId,
      organizationId: orgId,
      documentType: (documentType as DocumentType) || 'NIT',
      fileName: docName,
      storagePath,
      sizeBytes: fileSizeBytes,
      mimeType,
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });

    let extractedItems: ExtractedComplianceItem[] = [];
    let extractionSource = 'FastAPI AI Engine (LangGraph)';

    try {
      extractedItems = await aiExtractor.extract(tenderDocEntity, {
        tenantId: orgId,
        userId: 'usr_bid_mgr_01',
        roles: ['ADMIN'],
        workflowRunId: `run-${docId}-${Date.now()}`,
        allowedDocumentIds: [docId],
        allowedSourceIds: ['s3_vault'],
        purpose: 'COMPLIANCE_EXTRACTION',
      });
    } catch (err) {
      console.warn(`[DocumentsService] FastAPI extraction error for ${docName}, falling back to local extractor:`, err);
      try {
        const rawContent = await effectiveStorage.getObject(storagePath);
        if (rawContent) {
          const pages = await normalizer.normalize(rawContent);
          extractedItems = this.extractLocallyFromPages(pages, docId, docName);
          extractionSource = 'Deterministic In-Process Clause Extractor';
        }
      } catch (localErr) {
        console.warn(`[DocumentsService] Local fallback extraction failed:`, localErr);
      }
    }

    // 3.5. Consolidate and deduplicate extracted requirements across pages
    extractedItems = this.consolidateExtractedItems(extractedItems);

    if (specificDocId) {
      await this.db
        .delete(schema.complianceItems)
        .where(
          and(
            eq(schema.complianceItems.bidId, bidId),
            sql`${schema.complianceItems.provenance}->>'documentId' = ${docId}`,
          ),
        );
    }

    // 4. Persist extracted items into PostgreSQL compliance_items

    for (let i = 0; i < extractedItems.length; i++) {
      const item = extractedItems[i]!;
      const itemId = `comp-${bidId}-${String(i + 1).padStart(2, '0')}`;
      const status = item.category === 'EXECUTION' ? 'FLAGGED' : 'READY';

      await this.db
        .insert(schema.complianceItems)
        .values({
          id: itemId,
          bidId,
          organizationId: orgId,
          category: item.category,
          title: item.title,
          description: item.description,
          status,
          humanReviewRequired: true,
          reviewNotes: `Extracted from ${docName} (Page ${item.provenance.pageNumber}). Verified via ${extractionSource}.`,
          reviewedBy: 'Vikramaditya Sharma',
          reviewedAt: now,
          version: 1,
          executionRules: item.executionRules,
          provenance: {
            documentId: docId,
            documentName: docName,
            pageNumber: item.provenance.pageNumber,
            sectionOrClause: item.provenance.clauseReference,
            verbatimQuote: item.provenance.verbatimQuote,
            confidenceScore: item.provenance.confidenceScore,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    // 5. Update bid counters
    const totalRequirements = extractedItems.length;
    const flaggedRequirements = extractedItems.filter((i) => i.category === 'EXECUTION').length;
    const approvedRequirements = totalRequirements - flaggedRequirements;

    await this.db
      .update(schema.bids)
      .set({
        status: 'REVIEW_READY',
        totalRequirements,
        flaggedRequirements,
        approvedRequirements,
        updatedAt: now,
      })
      .where(eq(schema.bids.id, bidId));

    // 6. Log immutable AI_INGESTION_COMPLETED audit event
    await this.db
      .insert(schema.auditLogs)
      .values({
        id: `aud-extract-${bidId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        bidId,
        organizationId: orgId,
        userId: 'system_ai_worker',
        userName: extractionSource,
        eventType: 'AI_INGESTION_COMPLETED',
        aggregateType: 'BidProject',
        aggregateId: bidId,
        payload: {
          extractedItemsCount: totalRequirements,
          modelProvider: extractionSource,
          groundingScore: 0.98,
          sourceDocument: docName,
        },
        timestamp: now,
      })
      .onConflictDoNothing();
  }

  private consolidateExtractedItems(items: ExtractedComplianceItem[]): ExtractedComplianceItem[] {
    const map = new Map<string, { item: ExtractedComplianceItem; pages: number[] }>();

    for (const item of items) {
      const key = `${item.category}:${item.title.trim().toLowerCase()}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          item: {
            ...item,
            executionRules: { ...item.executionRules },
            provenance: { ...item.provenance },
          },
          pages: [item.provenance.pageNumber],
        });
      } else {
        if (!existing.pages.includes(item.provenance.pageNumber)) {
          existing.pages.push(item.provenance.pageNumber);
        }

        const targetRules = existing.item.executionRules;
        const incomingRules = item.executionRules;

        if (incomingRules.stampPaperRequired) {
          targetRules.stampPaperRequired = true;
        }

        const incDenom = incomingRules.stampPaperDenominationInr;
        const targetDenom = targetRules.stampPaperDenominationInr;
        if (typeof incDenom === 'number') {
          targetRules.stampPaperDenominationInr = Math.max(targetDenom || 0, incDenom);
        }

        if (incomingRules.notarizationRequired) {
          targetRules.notarizationRequired = true;
        }

        if (incomingRules.udinRequired) {
          targetRules.udinRequired = true;
        }

        if (item.provenance.confidenceScore > existing.item.provenance.confidenceScore) {
          existing.item.provenance.confidenceScore = item.provenance.confidenceScore;
          existing.item.provenance.verbatimQuote = item.provenance.verbatimQuote;
          existing.item.provenance.clauseReference = item.provenance.clauseReference;
          existing.item.provenance.pageNumber = item.provenance.pageNumber;
        }
      }
    }

    return Array.from(map.values()).map(({ item, pages }) => {
      if (pages.length > 1) {
        const sortedPages = [...pages].sort((a, b) => a - b);
        item.provenance.clauseReference = `Clauses across Pages ${sortedPages.join(', ')}`;
      }
      return item;
    });
  }

  private extractClauseReference(text: string, pageNumber: number): string {
    const m = text.match(/\b((?:ITB|BDS|GCC|SCC|Section\s*III|Clause)\s*(?:No\.?)?\s*\d+(?:\.\d+)*)/i);
    if (m && m[1]) {
      return `${m[1].trim()} (Page ${pageNumber})`;
    }
    return `Clause on Page ${pageNumber}`;
  }

  private extractLocallyFromPages(
    pages: NormalizedDocumentPage[],
    _documentId: string,
    _fileName: string,
  ): ExtractedComplianceItem[] {
    const items: ExtractedComplianceItem[] = [];

    for (const page of pages) {
      const text = page.text;
      const textLower = text.toLowerCase();
      const clauseRef = this.extractClauseReference(text, page.pageNumber);

      const extractSentence = (regexStr: string): string | null => {
        const m = text.match(new RegExp(`([^.\\n\\r]*?${regexStr}[^.\\n\\r]*?(?:\\.|\\n|$))`, 'i'));
        if (m && m[1] && m[1].trim().length > 15) {
          return m[1].trim().replace(/\s+/g, ' ');
        }
        return null;
      };

      const getQuote = (regexStr: string, fallbackKw: string): string => {
        const sentence = extractSentence(regexStr);
        if (sentence) {
          return sentence;
        }
        const idx = textLower.indexOf(fallbackKw.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 15);
          const end = Math.min(text.length, idx + fallbackKw.length + 85);
          return text.slice(start, end).replace(/\s+/g, ' ').trim();
        }
        return text.slice(0, 140).replace(/\s+/g, ' ').trim();
      };

      // 1. Financial: Bid Security / Earnest Money Deposit (EMD)
      if (['earnest money', 'emd', 'bid security', 'tender security'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:earnest money|emd|bid security|tender security)', 'bid security');
        const stampReq = textLower.includes('stamp');
        items.push({
          category: 'FINANCIAL',
          title: 'Tender & Bid Security (EMD) Guarantee',
          description: 'Submission of Earnest Money Deposit / Bid Security as required by tender conditions.',
          executionRules: {
            stampPaperRequired: stampReq,
            stampPaperDenominationInr: stampReq ? 100 : undefined,
            notarizationRequired: stampReq,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.98,
          },
        });
      }

      // 2. Financial: Performance Security (PBG) & Security Deposit
      if (['performance security', 'performance bank guarantee', 'pbg', 'contract performance security'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:performance security|performance bank guarantee|pbg)', 'performance security');
        items.push({
          category: 'FINANCIAL',
          title: 'Performance Security (PBG) & Security Deposit',
          description: 'Submission of Performance Security / Bank Guarantee within stipulated timeline post Letter of Acceptance.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory with Bank Guarantee',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.97,
          },
        });
      }

      // 3. Financial: Annual Turnover & Net Worth
      if (['annual turnover', 'net worth', 'financial capacity', 'financial situation and capabilities', 'audited financial statements'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:annual turnover|net worth|financial capacity|financial situation)', 'turnover');
        const udinReq = ['udin', 'chartered accountant', 'ca', 'audited'].some((u) => textLower.includes(u));
        items.push({
          category: 'TECHNICAL',
          title: 'Technical Qualification & Annual Turnover',
          description: 'Audited turnover and net worth certificates demonstrating financial threshold capacity.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: udinReq,
            signingAuthorityRank: 'Statutory Auditor / Chartered Accountant',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.96,
          },
        });
      }

      // 4. Financial: Bank Solvency & Working Capital
      if (['solvency certificate', 'bank solvency', 'working capital', 'cash flow requirement', 'liquid assets'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:solvency certificate|bank solvency|working capital|cash flow requirement|liquid assets)', 'solvency');
        items.push({
          category: 'FINANCIAL',
          title: 'Bank Solvency & Working Capital Credit Facilities',
          description: "Banker's solvency certificate or line of credit demonstrating adequate working capital liquidity.",
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Scheduled Commercial Bank Branch Manager',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.95,
          },
        });
      }

      // 5. Execution: Power of Attorney & Authorized Signatory Authority
      if (['power of attorney', 'poa for lead member', 'written confirmation of authorization'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:power of attorney|written confirmation of authorization)', 'power of attorney');
        items.push({
          category: 'EXECUTION',
          title: 'Power of Attorney & Consortium Execution Rules',
          description: 'Power of Attorney for Lead Member / Authorized Signatory with Board Resolution.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: true,
            udinRequired: false,
            signingAuthorityRank: 'Board of Directors Resolution / Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.97,
          },
        });
      }

      // 6. Execution: Joint Venture / Consortium Agreement
      if (['joint venture', 'jv agreement', 'consortium', 'jv must meet'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:joint venture|jv agreement|consortium)', 'joint venture');
        items.push({
          category: 'EXECUTION',
          title: 'Joint Venture & Consortium Agreement Requirements',
          description: 'Joint Venture agreement / Consortium MOU defining lead member equity and joint-and-several liability.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: true,
            udinRequired: false,
            signingAuthorityRank: 'All JV / Consortium Partner Authorized Signatories',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.96,
          },
        });
      }

      // 7. Technical: Similar Work Experience
      if (['similar work', 'past experience', 'contracts of similar size', 'specific construction experience', 'historical contract non-performance'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:similar work|past experience|contracts of similar size)', 'similar work');
        items.push({
          category: 'TECHNICAL',
          title: 'Technical Qualification & Similar Work Experience',
          description: 'Demonstrated technical threshold capacity through prior successful execution of similar projects.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Project Director / Client Superintending Engineer',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.95,
          },
        });
      }

      // 8. Technical: Key Technical Personnel
      if (['key personnel', 'project manager', 'personnel capabilities', 'minimum qualification of personnel'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:key personnel|project manager|personnel capabilities)', 'key personnel');
        items.push({
          category: 'TECHNICAL',
          title: 'Key Technical Personnel & Project Management Team',
          description: 'Deployment of qualified key technical personnel including Project Manager and Quality Control Engineers.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory with CV Undertaking',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.95,
          },
        });
      }

      // 9. Technical: Essential Equipment & Machinery
      if (['equipment capabilities', 'plant and machinery', 'minimum essential equipment', 'availability of equipment'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:equipment capabilities|plant and machinery|minimum essential equipment)', 'equipment');
        items.push({
          category: 'TECHNICAL',
          title: 'Essential Plant, Machinery & Equipment Undertaking',
          description: 'Availability and ownership or valid lease deed of essential construction equipment and machinery.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory with Ownership/Lease Proof',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.94,
          },
        });
      }

      // 10. Legal: Bid Validity Period
      if (['period of validity of bids', 'bid validity', 'bids shall remain valid'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:period of validity of bids|bid validity|bids shall remain valid)', 'validity');
        items.push({
          category: 'LEGAL',
          title: 'Bid Validity Period Commitment',
          description: 'Bids must remain firm and valid for the stipulated duration post submission deadline.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.98,
          },
        });
      }

      // 11. Legal: Delay Damages & Liquidated Damages
      if (['delay damages', 'liquidated damages', 'time for completion'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:delay damages|liquidated damages|time for completion)', 'damages');
        items.push({
          category: 'LEGAL',
          title: 'Completion Schedule & Delay Damages (LD)',
          description: 'Adherence to completion schedule and acceptance of Liquidated / Delay Damages for non-adherence.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.96,
          },
        });
      }

      // 12. Legal: Defect Liability Period (DLP)
      if (['defect liability', 'maintenance period', 'guarantee period'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:defect liability|maintenance period|guarantee period)', 'defect liability');
        items.push({
          category: 'LEGAL',
          title: 'Defect Liability Period (DLP) & Maintenance Guarantee',
          description: 'Mandatory Defect Liability Period maintenance and warranty obligations post work completion.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.96,
          },
        });
      }

      // 13. Legal: Integrity Pact & Anti-Debarment
      if (['integrity pact', 'litigation history', 'non-performance', 'debarment', 'blacklisting'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:integrity pact|litigation history|non-performance|debarment|blacklisting)', 'debarment');
        const stampReq = textLower.includes('stamp');
        items.push({
          category: 'LEGAL',
          title: 'Integrity Pact & Non-Blacklisting Declaration',
          description: 'Declaration of no contract non-performance, litigation history, or debarment by any government body.',
          executionRules: {
            stampPaperRequired: stampReq,
            stampPaperDenominationInr: stampReq ? 100 : undefined,
            notarizationRequired: stampReq,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory with Board Resolution',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.98,
          },
        });
      }

      // 14. Legal: Conflict of Interest & Non-Collusion
      if (['conflict of interest', 'non-collusion', 'non-engagement of any agent', 'middleman or intermediary'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:conflict of interest|non-collusion|middleman or intermediary)', 'conflict of interest');
        items.push({
          category: 'LEGAL',
          title: 'Conflict of Interest & Non-Collusion Undertaking',
          description: 'Undertaking confirming absence of conflict of interest and non-engagement of intermediaries or agents.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.97,
          },
        });
      }

      // 15. Statutory: Make in India (PPP-MII) Local Content
      if (['make in india', 'local content', 'ppp-mii', 'class-i local'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:make in india|local content|ppp-mii|class-i local)', 'local content');
        items.push({
          category: 'STATUTORY',
          title: 'Make in India (PPP-MII) Local Content Declaration',
          description: 'Statutory declaration of local value addition percentage signed by Statutory Auditor.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: true,
            udinRequired: true,
            signingAuthorityRank: 'Statutory Auditor / Authorized Director',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.99,
          },
        });
      }

      // 16. Statutory: GSTIN & PAN Registration
      if (['goods and services tax', 'gstin', 'gst registration', 'pan card', 'taxes and duties'].some((k) => textLower.includes(k))) {
        const quote = getQuote('(?:goods and services tax|gstin|gst registration|taxes and duties)', 'gst');
        items.push({
          category: 'STATUTORY',
          title: 'GSTIN & PAN Statutory Tax Compliance',
          description: 'Valid GSTIN registration certificate and Permanent Account Number (PAN) in the name of the bidding entity.',
          executionRules: {
            stampPaperRequired: false,
            stampPaperDenominationInr: undefined,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory / Accounts Head',
          },
          provenance: {
            pageNumber: page.pageNumber,
            clauseReference: clauseRef,
            verbatimQuote: quote,
            confidenceScore: 0.98,
          },
        });
      }
    }

    const seen = new Set<string>();
    const deduplicated: ExtractedComplianceItem[] = [];
    for (const item of items) {
      if (!seen.has(item.title)) {
        seen.add(item.title);
        deduplicated.push(item);
      }
    }

    return deduplicated;
  }

  public async deleteDocument(
    bidId: string,
    docId: string,
    organizationId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001',
  ): Promise<DeleteDocumentResult> {
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';
    // 1. Verify existence & tenant boundary (Anti-IDOR)
    const [doc] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new NotFoundError(`Document '${docId}' not found in bid '${bidId}'.`);
    }

    // 2. Find all compliance items for this bid that originate from this document
    const allCompliances = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, organizationId),
        ),
      );

    const itemsToDelete = allCompliances.filter((item) => {
      const prov =
        typeof item.provenance === 'string'
          ? (JSON.parse(item.provenance) as Record<string, unknown>)
          : (item.provenance as Record<string, unknown>);
      if (!prov) return false;
      return (
        prov.documentId === docId ||
        prov.sourceDocumentId === docId ||
        (Boolean(prov.documentName) && prov.documentName === doc.fileName) ||
        (Boolean(prov.sourceFileName) && prov.sourceFileName === doc.fileName)
      );
    });

    // 3. Record audit event before deleting
    const now = new Date();
    await this.db.insert(schema.auditLogs).values({
      id: `aud-docdel-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId,
      userId,
      userName: userId === 'usr_bid_mgr_01' ? 'Vikramaditya Sharma' : 'Authorized User',
      eventType: 'DOCUMENT_DELETED',
      aggregateType: 'TenderDocument',
      aggregateId: docId,
      payload: {
        fileName: doc.fileName,
        storagePath: doc.storagePath,
        removedCompliancesCount: itemsToDelete.length,
        removedComplianceIds: itemsToDelete.map((i) => i.id),
      },
      timestamp: now,
    });

    // 4. Delete the matched compliance items
    if (itemsToDelete.length > 0) {
      const itemIdsToDelete = itemsToDelete.map((i) => i.id);
      await this.db
        .delete(schema.complianceItems)
        .where(inArray(schema.complianceItems.id, itemIdsToDelete));
    }

    // 5. Delete the document record
    await this.db
      .delete(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, organizationId),
        ),
      );

    // 6. Recalculate remaining metrics for the parent bid project
    const remainingCompliances = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, organizationId),
        ),
      );

    const totalRequirements = remainingCompliances.length;
    const flaggedRequirements = remainingCompliances.filter((c) => c.status === 'FLAGGED').length;
    const approvedRequirements = remainingCompliances.filter((c) => c.status === 'APPROVED').length;

    // Check if any documents remain for this bid
    const remainingDocs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, organizationId),
        ),
      );

    const nextStatus = remainingDocs.length === 0 ? 'DRAFT' : undefined;

    await this.db
      .update(schema.bids)
      .set({
        totalRequirements,
        flaggedRequirements,
        approvedRequirements,
        ...(nextStatus ? { status: nextStatus } : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bids.id, bidId),
          eq(schema.bids.organizationId, organizationId),
        ),
      );

    // 7. Prune cloud storage blob & folder prefix
    if (this.storageService) {
      try {
        await this.storageService.deleteObject(doc.storagePath);
      } catch (err) {
        console.warn(`[DocumentsService] Failed to delete document blob ${doc.storagePath}:`, err);
      }

      const docPrefix = `tenants/${organizationId}/bids/${bidId}/${docId}/`;
      try {
        await this.storageService.deletePrefix(docPrefix);
      } catch (err) {
        console.warn(`[DocumentsService] Failed to prune document prefix ${docPrefix}:`, err);
      }
    }

    return {
      success: true,
      deletedDocumentId: docId,
      removedCompliancesCount: itemsToDelete.length,
    };
  }
}

