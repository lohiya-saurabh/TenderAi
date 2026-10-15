/**
 * CompanyEvidenceService — Application service for managing company evidence documents.
 *
 * Coordinates ingestion from:
 * 1. Direct browser uploads (LocalUploadConnector)
 * 2. Cloud storage drives (GoogleDriveConnector, OneDriveConnector)
 * 3. DigiLocker / Government digital depositories
 *
 * Implements cryptographic hashing (SHA-256), multi-tenant storage isolation,
 * and integration with CompanyProfileService evidence vault citations.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../../common/database/database.module.js';
import * as schema from '../../../common/database/schema.js';
import { NotFoundError, BadRequestError } from '../../../common/errors/errors.js';
import { TenantContextHolder } from '../../../common/security/TenantContext.js';
import { STORAGE_TOKEN } from '../../../infrastructure/storage/storage.module.js';
import type { IStorageService } from '../../bids/application/IStorageService.js';
import { GoogleDriveConnector } from '../infrastructure/GoogleDriveConnector.js';
import { OneDriveConnector } from '../infrastructure/OneDriveConnector.js';
import { LocalUploadConnector } from '../infrastructure/LocalUploadConnector.js';
import { AiEvidenceExtractor } from './AiEvidenceExtractor.js';

export interface UploadEvidenceDto {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  evidenceType: string; // 'AUDITED_BALANCE_SHEET', 'WORK_ORDER', 'COMPLETION_CERT', 'GST_REG', 'UDYAM_CERT', 'ISO_CERT', 'PAN_CARD', 'INCORPORATION_CERT', 'OTHER'
  issuer?: string;
  referenceNumber?: string;
  validFrom?: string; // ISO date
  validTo?: string; // ISO date
  extractedAttributes?: Record<string, unknown>;
}

export interface ImportCloudEvidenceDto {
  provider: 'google-drive' | 'onedrive';
  fileId: string;
  fileName?: string;
  evidenceType: string;
  authContext?: Record<string, unknown>;
  issuer?: string;
  referenceNumber?: string;
  validFrom?: string;
  validTo?: string;
}

/**
 * Robust date parser supporting Indian formats (DD/MM/YYYY, DD-MM-YYYY)
 * as well as ISO-8601 (YYYY-MM-DD), avoiding Invalid Date exceptions in PostgreSQL.
 */
export function parseFlexibleDate(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput !== 'string') return null;
  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  // 1. Indian formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (with optional time)
  const ddmmyyyyMatch = trimmed.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (ddmmyyyyMatch && ddmmyyyyMatch[1] && ddmmyyyyMatch[2] && ddmmyyyyMatch[3]) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const hour = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
    const min = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0;
    const sec = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day, hour, min, sec));
      if (!isNaN(d.getTime()) && d.getUTCDate() === day && d.getUTCMonth() === month) {
        return d;
      }
    }
  }

  // 2. Standard ISO 8601 or other parseable formats
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

@Injectable()
export class CompanyEvidenceService {
  private readonly db: DrizzleDb;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Optional() @Inject(STORAGE_TOKEN) private readonly storageService?: IStorageService | null,
    @Optional() private readonly googleDriveConnector?: GoogleDriveConnector,
    @Optional() private readonly oneDriveConnector?: OneDriveConnector,
    @Optional() private readonly localUploadConnector?: LocalUploadConnector,
    @Optional() private readonly aiEvidenceExtractor?: AiEvidenceExtractor,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Upload an evidence document directly to object storage and register in evidence vault.
   */
  public async uploadEvidence(
    companyId: string,
    dto: UploadEvidenceDto,
  ): Promise<schema.CompanyEvidenceDocument> {
    const orgId = this.requireOrg();
    await this.verifyCompanyOwnership(companyId, orgId);

    const connector = this.localUploadConnector ?? new LocalUploadConnector();
    const processed = await connector.downloadFile({
      buffer: dto.buffer,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
    });

    const docId = `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const sha256Hash = crypto.createHash('sha256').update(processed.buffer).digest('hex');
    const sanitizedFileName = processed.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `tenants/${orgId}/companies/${companyId}/evidence/${docId}/${sanitizedFileName}`;

    // Persist to polymorphic object storage
    if (this.storageService?.putObject) {
      await this.storageService.putObject(storagePath, dto.buffer, dto.mimeType);
    }

    const now = new Date();
    const [inserted] = await this.db
      .insert(schema.companyEvidenceDocuments)
      .values({
        id: docId,
        organizationId: orgId,
        companyId,
        fileName: sanitizedFileName,
        storagePath,
        fileSizeBytes: dto.buffer.byteLength,
        mimeType: dto.mimeType || 'application/pdf',
        sha256Hash,
        evidenceType: dto.evidenceType || 'OTHER',
        issuer: dto.issuer ?? null,
        referenceNumber: dto.referenceNumber ?? null,
        validFrom: parseFlexibleDate(dto.validFrom),
        validTo: parseFlexibleDate(dto.validTo),
        sourceProvider: 'LOCAL_UPLOAD',
        sourceReference: null,
        importedAt: now,
        verificationStatus: 'IMPORTED',
        verificationMethod: 'MANUAL_UPLOAD',
        verifiedAt: null,
        verifiedBy: null,
        discrepancyNotes: null,
        extractedAttributes: dto.extractedAttributes ?? null,
        metadata: { originalName: dto.fileName },
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Automatically trigger AI extraction and chunking
    const extracted = await this.extractAndPersistChunks(companyId, inserted!.id, dto.buffer);
    return extracted ?? inserted!;
  }

  /**
   * Import evidence from connected cloud drive (Google Drive or Microsoft OneDrive).
   */
  public async importFromCloudSource(
    companyId: string,
    dto: ImportCloudEvidenceDto,
  ): Promise<schema.CompanyEvidenceDocument> {
    const orgId = this.requireOrg();
    await this.verifyCompanyOwnership(companyId, orgId);

    const connector =
      dto.provider === 'google-drive'
        ? this.googleDriveConnector || new GoogleDriveConnector()
        : this.oneDriveConnector || new OneDriveConnector();

    const downloaded = await connector.downloadFile(
      { ...(dto.authContext || {}), fileName: dto.fileName },
      dto.fileId,
    );

    return this.uploadEvidence(companyId, {
      fileName: downloaded.fileName,
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType,
      evidenceType: dto.evidenceType,
      issuer: dto.issuer,
      referenceNumber: dto.referenceNumber,
      validFrom: dto.validFrom,
      validTo: dto.validTo,
    });
  }

  /**
   * List all evidence documents registered for the company within caller's tenant.
   */
  public async listEvidence(companyId: string): Promise<schema.CompanyEvidenceDocument[]> {
    const orgId = this.requireOrg();
    await this.verifyCompanyOwnership(companyId, orgId);

    return this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
          eq(schema.companyEvidenceDocuments.companyId, companyId),
        ),
      )
      .orderBy(desc(schema.companyEvidenceDocuments.createdAt));
  }

  /**
   * Get single evidence item with anti-IDOR validation.
   */
  public async getEvidenceById(
    companyId: string,
    evidenceId: string,
  ): Promise<schema.CompanyEvidenceDocument> {
    const orgId = this.requireOrg();
    await this.verifyCompanyOwnership(companyId, orgId);

    const [doc] = await this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.id, evidenceId),
          eq(schema.companyEvidenceDocuments.companyId, companyId),
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new NotFoundError(`Evidence document '${evidenceId}' not found.`);
    }

    return doc;
  }

  /**
   * Delete evidence item and purge from storage.
   */
  public async deleteEvidence(companyId: string, evidenceId: string): Promise<void> {
    const doc = await this.getEvidenceById(companyId, evidenceId);

    if (this.storageService) {
      await this.storageService.deleteObject(doc.storagePath).catch(() => {});
    }

    await this.db
      .delete(schema.companyEvidenceDocuments)
      .where(eq(schema.companyEvidenceDocuments.id, evidenceId));
  }

  /**
   * Extract attributes (UDIN, turnover, contract values, ISO accreditations)
   * and semantic chunks from company evidence document and persist to company_evidence_chunks.
   */
  public async extractAndPersistChunks(
    companyId: string,
    evidenceId: string,
    rawBuffer?: Buffer,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const orgId = this.requireOrg();
    await this.verifyCompanyOwnership(companyId, orgId);

    const doc = await this.getEvidenceById(companyId, evidenceId);
    if (!doc) return null;

    let downloadUrl: string | undefined;
    if (this.storageService?.generatePresignedDownloadUrl && doc.storagePath) {
      try {
        downloadUrl = await this.storageService.generatePresignedDownloadUrl(
          doc.storagePath,
          doc.fileName,
          900,
        );
      } catch {
        // Fallback to inline or mock
      }
    }

    let bufferText: string | undefined;
    if (rawBuffer) {
      bufferText = rawBuffer.toString('utf-8', 0, Math.min(rawBuffer.length, 32768));
    }

    const extractor = this.aiEvidenceExtractor ?? new AiEvidenceExtractor();
    try {
      const result = await extractor.extractEvidence(doc, undefined, downloadUrl, bufferText);

      if (result.chunks && result.chunks.length > 0) {
        // Idempotently replace existing chunks for this evidence document
        await this.db
          .delete(schema.companyEvidenceChunks)
          .where(eq(schema.companyEvidenceChunks.evidenceDocumentId, doc.id));

        for (let i = 0; i < result.chunks.length; i++) {
          const c = result.chunks[i]!;
          await this.db.insert(schema.companyEvidenceChunks).values({
            id: `chk_${doc.id}_${i}`,
            organizationId: orgId,
            companyId,
            evidenceDocumentId: doc.id,
            chunkIndex: c.chunk_index ?? i,
            chunkType: c.chunk_type || 'GENERAL',
            content: c.content,
            pageNumber: c.page_number ?? 1,
            clauseReference: c.clause_reference ?? `Page ${c.page_number ?? 1}`,
            boundingBox: c.bounding_box ?? null,
            metadata: c.metadata ?? null,
            embedding: null,
          });
        }
      }

      const extractedAttrs = result.extracted_attributes ?? {};
      const updates: Partial<schema.CompanyEvidenceDocument> = {
        extractedAttributes: {
          ...((doc.extractedAttributes as Record<string, unknown>) || {}),
          ...extractedAttrs,
        },
        verificationStatus: 'EXTRACTED',
        updatedAt: new Date(),
      };
      if (!doc.issuer && extractedAttrs.issuer) {
        updates.issuer = String(extractedAttrs.issuer);
      }
      if (!doc.referenceNumber && extractedAttrs.reference_number) {
        updates.referenceNumber = String(extractedAttrs.reference_number);
      }
      if (!doc.validFrom && extractedAttrs.valid_from) {
        const parsed = parseFlexibleDate(String(extractedAttrs.valid_from));
        if (parsed) updates.validFrom = parsed;
      }
      if (!doc.validTo && extractedAttrs.valid_to) {
        const parsed = parseFlexibleDate(String(extractedAttrs.valid_to));
        if (parsed) updates.validTo = parsed;
      }

      const [updated] = await this.db
        .update(schema.companyEvidenceDocuments)
        .set(updates)
        .where(
          and(
            eq(schema.companyEvidenceDocuments.id, doc.id),
            eq(schema.companyEvidenceDocuments.organizationId, orgId),
            eq(schema.companyEvidenceDocuments.companyId, companyId),
          ),
        )
        .returning();

      return updated ?? doc;
    } catch {
      // Graceful degradation: never crash evidence management if AI service is temporarily offline
      return doc;
    }
  }

  private async verifyCompanyOwnership(companyId: string, orgId: string): Promise<schema.Company> {
    const [comp] = await this.db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .limit(1);

    if (!comp) {
      throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
    }

    return comp;
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required.');
    }
    return orgId;
  }
}
