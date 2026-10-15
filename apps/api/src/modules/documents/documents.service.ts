/**
 * DocumentsService — Upload URL generation, upload confirmation, and download URL resolution.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, inArray } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { STORAGE_TOKEN } from '@/infrastructure/storage/storage.module.js';
import type { IStorageService } from '@/modules/bids/application/IStorageService.js';
import { ConflictError, NotFoundError, BadRequestError } from '@/common/errors/errors.js';
import { TenderDocumentRelevanceValidator } from '@/modules/documents/TenderDocumentRelevanceValidator.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';

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

export interface ReprocessDocumentResult {
  documentId: string;
  status: string;
  jobId: string;
}

export interface DeleteDocumentResult {
  success: boolean;
  deletedDocumentId: string;
  removedCompliancesCount: number;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
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
    @Inject(STORAGE_TOKEN) private readonly storageService: IStorageService | null,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async registerUploadedMockObject(storagePath: string, content: Buffer): Promise<void> {
    if (this.storageService) {
      if (typeof this.storageService.putObject === 'function') {
        await this.storageService.putObject(storagePath, content, 'application/pdf');
      } else if (
        typeof (this.storageService as unknown as Record<string, unknown>)
          .simulateUploadedObject === 'function'
      ) {
        (
          this.storageService as unknown as {
            simulateUploadedObject: (p: string, s: number, c?: string, b?: Buffer) => void;
          }
        ).simulateUploadedObject(storagePath, content.length, undefined, content);
      }
    }
  }

  /**
   * Resolves tenant organization ID from authenticated JWT context.
   * If TenantContext is missing (e.g. unauthenticated test harness), falls back to 'org_default'.
   */
  public resolveTenantOrgId(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (orgId) return orgId;
    return 'org_default';
  }

  /**
   * Lookup helper used strictly for unauthenticated mock upload simulation (S3 PUT emulation),
   * where HTTP callers send raw binary streams directly to the mock storage endpoint without a Bearer token.
   */
  public async getOrgIdForBid(bidId: string): Promise<string> {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (orgId) return orgId;
    const [bid] = await this.db
      .select({ organizationId: schema.bids.organizationId })
      .from(schema.bids)
      .where(eq(schema.bids.id, bidId))
      .limit(1);
    return bid?.organizationId || 'org_default';
  }

  public async generateUploadUrl(
    bidId: string,
    rawFileName?: string,
    rawMimeType?: string,
    hostHeader?: string,
    rawSizeBytes?: number,
    rawDocumentType?: string,
  ): Promise<UploadUrlResult> {
    const orgId = this.resolveTenantOrgId();

    // Verify bid exists and belongs to the caller's authenticated tenant boundary (Anti-IDOR)
    const [bidRecord] = await this.db
      .select({ id: schema.bids.id })
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bidRecord) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const docId = `doc-${Date.now()}`;
    const fileName =
      typeof rawFileName === 'string' && rawFileName.trim() ? rawFileName.trim() : 'document.pdf';
    const storagePath = `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;
    const contentType = (typeof rawMimeType === 'string' && rawMimeType) || 'application/pdf';
    const sizeBytes =
      typeof rawSizeBytes === 'number' && rawSizeBytes > 0 ? rawSizeBytes : undefined;
    const documentType =
      typeof rawDocumentType === 'string' && rawDocumentType.trim()
        ? rawDocumentType.trim()
        : 'NIT';

    this.pendingUploads.set(docId, {
      fileName,
      mimeType: contentType,
      storagePath,
      bidId,
      sizeBytes,
      documentType,
    });

    const protocol =
      hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')
        ? 'https'
        : 'http';
    const fallbackLocalUploadUrl = `${protocol}://${hostHeader || 'localhost:3000'}/api/v1/mock-upload/${bidId}/${docId}/${encodeURIComponent(fileName)}`;

    let uploadUrl: string;
    if (this.storageService) {
      uploadUrl = await this.storageService.generatePresignedUploadUrl(
        storagePath,
        contentType,
        900,
      );
      // If mock storage returned a mock domain that cannot resolve via public DNS, route to local mock upload endpoint
      if (uploadUrl.includes('mock-s3.tenderpulse.local') || uploadUrl.includes('.local/')) {
        uploadUrl = fallbackLocalUploadUrl;
      }
    } else {
      uploadUrl = fallbackLocalUploadUrl;
    }

    this.logger.debug(
      `Generated presigned upload URL for doc ${docId} (bid: ${bidId}, type: ${documentType}, path: ${storagePath})`,
    );

    return {
      documentId: docId,
      uploadUrl,
      storagePath,
      s3Key: storagePath,
      expiresInSeconds: 900,
    };
  }

  public async confirmUpload(bidId: string, rawDocumentId?: string): Promise<ConfirmUploadResult> {
    const orgId = this.resolveTenantOrgId();
    const userId = TenantContextHolder.get()?.userId || 'usr_admin';

    const [bidRecord] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bidRecord) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const companyId = bidRecord.companyId;

    const docId =
      typeof rawDocumentId === 'string' && rawDocumentId.trim()
        ? rawDocumentId.trim()
        : `doc-${Date.now()}`;
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

    let fileName = pending?.fileName || existingDoc?.fileName;
    let storagePath = pending?.storagePath || existingDoc?.storagePath;
    const mimeType = pending?.mimeType || existingDoc?.mimeType || 'application/pdf';
    const documentType = pending?.documentType || existingDoc?.documentType || 'NIT';

    // If fileName or storagePath is not known or generic, discover real file name from object storage
    if ((!fileName || !storagePath) && this.storageService) {
      try {
        const matchedFiles = await this.storageService.findFilesByPrefix(
          `tenants/${orgId}/bids/${bidId}/${docId}/`,
        );
        if (matchedFiles.length > 0) {
          storagePath = matchedFiles[0]!;
          fileName = storagePath.split('/').pop() || fileName;
        }
      } catch (err) {
        console.warn(
          `[DocumentsService] Failed to find files by prefix in storage for ${docId}:`,
          err,
        );
      }
    }

    fileName = fileName || 'Uploaded_Tender_Document.pdf';
    storagePath = storagePath || `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;
    const now = new Date();

    if (!this.storageService) {
      throw new Error('Object storage is required to confirm a document upload.');
    }
    const objectMetadata = await this.storageService.headObject(storagePath);
    if (!objectMetadata.exists || objectMetadata.sizeBytes <= 0) {
      throw new Error(`Uploaded document is missing or empty in object storage: ${storagePath}`);
    }
    const fileSizeBytes = objectMetadata.sizeBytes;

    if (
      existingDoc &&
      ['QUEUED_FOR_EXTRACTION', 'PROCESSING', 'COMPLETED'].includes(existingDoc.status)
    ) {
      return { documentId: docId, status: 'UPLOADED' };
    }

    // Validate document relevance against target tender metadata before persisting or enqueuing
    let docBuffer: Buffer | string | null = null;
    try {
      docBuffer = await this.storageService.getObject(storagePath);
    } catch (err) {
      this.logger.warn(
        `Failed to read object buffer for relevance validation: ${storagePath}`,
        err,
      );
    }

    if (docBuffer && docBuffer.length > 0) {
      const validator = new TenderDocumentRelevanceValidator();
      const validation = await validator.validate({
        documentId: docId,
        fileName,
        content: docBuffer,
        tender: {
          id: bidRecord.id,
          title: bidRecord.title,
          tenderNumber: bidRecord.tenderNumber,
          tenderingAuthority: bidRecord.tenderingAuthority,
          locationState: bidRecord.locationState,
          estimatedValueRupees: bidRecord.estimatedValueRupees
            ? Number(bidRecord.estimatedValueRupees)
            : null,
        },
      });

      if (!validation.isRelevant) {
        throw new BadRequestError(
          validation.rejectionReason ||
            `The uploaded document '${fileName}' is not relevant to tender '${bidRecord.title}'. Tender reference number, authority, or project keywords could not be verified in document content.`,
        );
      }
    }

    let downloadUrl: string | undefined;
    if (this.storageService) {
      try {
        downloadUrl = await this.storageService.generatePresignedDownloadUrl(
          storagePath,
          fileName,
          3600,
        );
      } catch (err) {
        this.logger.warn(`Failed to generate presigned download URL for ${storagePath}:`, err);
      }
    }

    const workflowRunId = `run-${docId}`;
    const correlationId = `corr-${docId}`;
    const jobId = `job-${docId}`;
    const message = {
      jobId,
      organizationId: orgId,
      companyId,
      bidId,
      documentId: docId,
      workflowRunId,
      correlationId,
      storageReference: storagePath,
      downloadUrl,
      documentType,
      fileName,
      timestamp: now.toISOString(),
    };

    await this.db.transaction(async (tx) => {
      const persistedDocument = await tx
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
          status: 'QUEUED_FOR_EXTRACTION',
          processingAttempts: 0,
          processingStartedAt: null,
          processingCompletedAt: null,
          lastProcessingError: null,
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
            status: 'QUEUED_FOR_EXTRACTION',
            processingAttempts: 0,
            processingStartedAt: null,
            processingCompletedAt: null,
            lastProcessingError: null,
            uploadedAt: now,
          },
          setWhere: and(
            eq(schema.tenderDocuments.organizationId, orgId),
            eq(schema.tenderDocuments.bidId, bidId),
          ),
        })
        .returning({ id: schema.tenderDocuments.id });
      if (persistedDocument.length === 0) {
        throw new ConflictError('Document ID is already assigned to another tenant or bid.');
      }

      await tx
        .update(schema.bids)
        .set({ status: 'QUEUED', updatedAt: now })
        .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));

      await tx.insert(schema.auditLogs).values({
        id: `aud-upload-${docId}-${randomUUID()}`,
        bidId,
        organizationId: orgId,
        userId,
        userName: userId,
        eventType: 'DOCUMENT_UPLOADED',
        aggregateType: 'TenderDocument',
        aggregateId: docId,
        payload: { fileName, storagePath },
        timestamp: now,
      });

      await tx
        .insert(schema.documentProcessingOutbox)
        .values({
          id: `outbox-${docId}`,
          organizationId: orgId,
          documentId: docId,
          payload: message,
          status: 'PENDING',
          nextAttemptAt: now,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: schema.documentProcessingOutbox.id,
          set: {
            payload: message,
            status: 'PENDING',
            attempts: 0,
            nextAttemptAt: now,
            lastError: null,
            publishedAt: null,
          },
        });
    });

    this.logger.log(
      `Confirmed upload for doc ${docId} (bid: ${bidId}, size: ${fileSizeBytes}B). Enqueued outbox event outbox-${docId}.`,
    );

    return {
      documentId: docId,
      status: 'UPLOADED',
    };
  }

  public async reprocessDocument(bidId: string, docId: string): Promise<ReprocessDocumentResult> {
    const orgId = await this.getOrgIdForBid(bidId);
    const userId = TenantContextHolder.get()?.userId || 'usr_admin';
    const [source] = await this.db
      .select({
        document: schema.tenderDocuments,
        bid: schema.bids,
      })
      .from(schema.tenderDocuments)
      .innerJoin(
        schema.bids,
        and(
          eq(schema.bids.id, schema.tenderDocuments.bidId),
          eq(schema.bids.organizationId, schema.tenderDocuments.organizationId),
        ),
      )
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!source) {
      throw new NotFoundError(`Document '${docId}' not found in bid '${bidId}'.`);
    }
    if (
      source.document.status === 'PROCESSING' ||
      source.document.status === 'QUEUED_FOR_EXTRACTION'
    ) {
      throw new ConflictError(`Document '${docId}' is already queued or processing.`);
    }
    if (!this.storageService) {
      throw new Error('Object storage is required to reprocess a document.');
    }
    const objectMetadata = await this.storageService.headObject(source.document.storagePath);
    if (!objectMetadata.exists || objectMetadata.sizeBytes <= 0) {
      throw new Error(
        `Uploaded document is missing or empty in object storage: ${source.document.storagePath}`,
      );
    }

    let downloadUrl: string | undefined;
    if (this.storageService) {
      try {
        downloadUrl = await this.storageService.generatePresignedDownloadUrl(
          source.document.storagePath,
          source.document.fileName,
          3600,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to generate presigned download URL for ${source.document.storagePath}:`,
          err,
        );
      }
    }

    const now = new Date();
    const jobId = `job-${docId}-${randomUUID()}`;
    const workflowRunId = `run-${randomUUID()}`;
    const correlationId = `corr-${randomUUID()}`;
    const message = {
      jobId,
      organizationId: orgId,
      companyId: source.bid.companyId,
      bidId,
      documentId: docId,
      workflowRunId,
      correlationId,
      storageReference: source.document.storagePath,
      downloadUrl,
      documentType: source.document.documentType,
      fileName: source.document.fileName,
      timestamp: now.toISOString(),
    };

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.tenderDocuments)
        .set({
          status: 'QUEUED_FOR_EXTRACTION',
          processingAttempts: 0,
          processingStartedAt: null,
          processingCompletedAt: null,
          lastProcessingError: null,
        })
        .where(
          and(
            eq(schema.tenderDocuments.id, docId),
            eq(schema.tenderDocuments.bidId, bidId),
            eq(schema.tenderDocuments.organizationId, orgId),
          ),
        );
      await tx
        .update(schema.bids)
        .set({ status: 'QUEUED', updatedAt: now })
        .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));
      await tx.insert(schema.documentProcessingOutbox).values({
        id: `outbox-${jobId}`,
        organizationId: orgId,
        documentId: docId,
        payload: message,
        status: 'PENDING',
        nextAttemptAt: now,
        createdAt: now,
      });
      await tx.insert(schema.auditLogs).values({
        id: `aud-reprocess-${randomUUID()}`,
        bidId,
        organizationId: orgId,
        userId,
        userName: 'Authorized User',
        eventType: 'DOCUMENT_REPROCESS_REQUESTED',
        aggregateType: 'TenderDocument',
        aggregateId: docId,
        payload: { jobId, workflowRunId, correlationId },
        timestamp: now,
      });
    });

    return { documentId: docId, status: 'QUEUED_FOR_EXTRACTION', jobId };
  }

  // NOTE: markExtractionComplete() has been REMOVED.
  // Document extraction is now handled exclusively by the FastAPI worker
  // consuming from the message queue. NestJS only enqueues the job.
  // See apps/ai/src/tenderpulse_ai/worker/ for the queue consumer implementation.

  public async getDownloadUrl(
    bidId: string,
    docId: string,
    hostHeader?: string,
  ): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const orgId = await this.getOrgIdForBid(bidId);
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
    let storagePath = docRow?.storagePath || `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;

    if (this.storageService) {
      try {
        const matchedFiles = await this.storageService.findFilesByPrefix(
          `tenants/${orgId}/bids/${bidId}/${docId}/`,
        );

        if (matchedFiles.length > 0) {
          storagePath = matchedFiles[0]!;
          fileName = storagePath.split('/').pop() || fileName;

          const downloadUrl = await this.storageService.generatePresignedDownloadUrl(
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
        console.warn(`[DocumentsService] Failed to generate download URL for ${storagePath}:`, err);
      }
    }

    const protocol =
      hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')
        ? 'https'
        : 'http';
    const downloadUrl = `${protocol}://${hostHeader || 'localhost:3000'}/api/v1/mock-download/${bidId}/${docId}/${encodeURIComponent(fileName)}`;
    return {
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }

  public async getBidExtractionProgress(bidId: string): Promise<{
    status: 'COMPLETED' | 'PROCESSING' | 'QUEUED' | 'FAILED';
    step: string;
    progress: number;
    message: string;
  }> {
    const orgId = await this.getOrgIdForBid(bidId);
    const [bid] = await this.db
      .select({ status: schema.bids.status })
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    const docs = await this.db
      .select({ status: schema.tenderDocuments.status })
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      );

    if (
      bid?.status === 'REVIEW_READY' ||
      (docs.length > 0 && docs.every((d) => d.status === 'COMPLETED'))
    ) {
      return {
        status: 'COMPLETED',
        step: 'COMPLETED',
        progress: 100,
        message: 'Tender intelligence and compliance matrix ready for human review.',
      };
    }

    if (bid?.status === 'FAILED' || (docs.length > 0 && docs.some((d) => d.status === 'FAILED'))) {
      return {
        status: 'FAILED',
        step: 'FAILED',
        progress: 100,
        message: 'Document extraction failed.',
      };
    }

    if (bid?.status === 'PROCESSING' || docs.some((d) => d.status === 'PROCESSING')) {
      return {
        status: 'PROCESSING',
        step: 'EXTRACTING_COMPLIANCE',
        progress: 65,
        message: 'FastAPI worker is processing the tender document in the background...',
      };
    }

    return {
      status: 'QUEUED',
      step: 'PARSING_PAGES',
      progress: 30,
      message: 'Document accepted. Queued for async worker processing...',
    };
  }

  public async deleteDocument(
    bidId: string,
    docId: string,
    organizationId?: string,
  ): Promise<DeleteDocumentResult> {
    const orgId = organizationId || (await this.getOrgIdForBid(bidId));
    const userId = TenantContextHolder.get()?.userId || 'usr_admin';
    // 1. Verify existence & tenant boundary (Anti-IDOR)
    const [doc] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
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
          eq(schema.complianceItems.organizationId, orgId),
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
      organizationId: orgId,
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
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      );

    // 6. Recalculate remaining metrics for the parent bid project
    const remainingCompliances = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
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
          eq(schema.tenderDocuments.organizationId, orgId),
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
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));

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
