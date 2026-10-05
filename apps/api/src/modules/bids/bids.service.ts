/**
 * BidsService — CRUD operations for bid projects against PostgreSQL.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, asc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import { STORAGE_TOKEN } from '../../infrastructure/storage/storage.module.js';
import type { IStorageService } from './application/IStorageService.js';
import * as schema from '../../common/database/schema.js';
import { NotFoundError } from '../../common/errors/errors.js';
import type { DemoBid, DemoDocument } from '../../seed/data.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

export interface CreateBidDto {
  title?: string;
  tenderNumber?: string;
  tenderingAuthority?: string;
  estimatedValueRupees?: number | string;
  submissionDeadline?: string | null;
  locationState?: string | null;
}

export interface DeleteBidResult {
  success: boolean;
  deletedBidId: string;
  deletedDocumentsCount: number;
}

@Injectable()
export class BidsService {
  private readonly db: DrizzleDb;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Optional() @Inject(STORAGE_TOKEN) private readonly storageService?: IStorageService | null,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listBids(): Promise<DemoBid[]> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const allBids = await this.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, orgId))
      .orderBy(desc(schema.bids.createdAt));
    const allDocs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.organizationId, orgId));

    const docsByBid = new Map<string, DemoDocument[]>();
    for (const doc of allDocs) {
      if (!docsByBid.has(doc.bidId)) {
        docsByBid.set(doc.bidId, []);
      }
      docsByBid.get(doc.bidId)!.push({
        id: doc.id,
        fileName: doc.fileName,
        fileSizeBytes: Number(doc.fileSizeBytes),
        mimeType: doc.mimeType,
        documentType: doc.documentType,
        status: doc.status,
        uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : String(doc.uploadedAt),
      });
    }

    return allBids.map((b) => this.mapBidRecord(b, docsByBid.get(b.id) || []));
  }

  public async getBidById(bidId: string): Promise<DemoBid> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const [bidRecord] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bidRecord) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const docs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(and(eq(schema.tenderDocuments.bidId, bidId), eq(schema.tenderDocuments.organizationId, orgId)))
      .orderBy(asc(schema.tenderDocuments.uploadedAt));

    const documents: DemoDocument[] = [];
    for (const d of docs) {
      let fileName = d.fileName;
      let storagePath = d.storagePath;
      let sizeBytes = Number(d.fileSizeBytes);

      if (
        this.storageService &&
        (fileName === 'Uploaded_Tender_Document.pdf' || sizeBytes === 4000000 || sizeBytes === 0)
      ) {
        try {
          if (
            fileName === 'Uploaded_Tender_Document.pdf' &&
            typeof (this.storageService as unknown as { findFilesByPrefix?: (p: string) => Promise<string[]> }).findFilesByPrefix === 'function'
          ) {
            const matched = await (this.storageService as unknown as { findFilesByPrefix: (p: string) => Promise<string[]> }).findFilesByPrefix(
              `tenants/${orgId}/bids/${bidId}/${d.id}/`,
            );
            if (matched && matched.length > 0) {
              storagePath = matched[0]!;
              fileName = storagePath.split('/').pop() || fileName;
            }
          }

          const head = await this.storageService.headObject(storagePath);
          if (head && head.exists && head.sizeBytes > 0) {
            sizeBytes = head.sizeBytes;
          }

          void this.db
            .update(schema.tenderDocuments)
            .set({ fileName, storagePath, fileSizeBytes: sizeBytes })
            .where(eq(schema.tenderDocuments.id, d.id));
        } catch {
          // ignore
        }
      }

      documents.push({
        id: d.id,
        fileName,
        fileSizeBytes: sizeBytes,
        mimeType: d.mimeType,
        documentType: d.documentType,
        status: d.status,
        uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
      });
    }

    return this.mapBidRecord(bidRecord, documents);
  }

  public async createBid(dto: CreateBidDto): Promise<DemoBid> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';
    const newBidId = `bid-${Date.now()}`;
    const title = typeof dto.title === 'string' && dto.title.trim() ? dto.title.trim() : 'Untitled Tender';
    const tenderNumber =
      typeof dto.tenderNumber === 'string' && dto.tenderNumber.trim()
        ? dto.tenderNumber.trim()
        : `TNDR-${Date.now()}`;
    const tenderingAuthority =
      typeof dto.tenderingAuthority === 'string' && dto.tenderingAuthority.trim()
        ? dto.tenderingAuthority.trim()
        : 'Government Authority';
    const estimatedValueRupees =
      typeof dto.estimatedValueRupees === 'number'
        ? dto.estimatedValueRupees
        : Number(dto.estimatedValueRupees) || 0;
    const submissionDeadline = typeof dto.submissionDeadline === 'string' ? dto.submissionDeadline : null;
    const locationState =
      typeof dto.locationState === 'string' && dto.locationState.trim()
        ? dto.locationState.trim()
        : null;
    const now = new Date();

    await this.db.insert(schema.bids).values({
      id: newBidId,
      organizationId: orgId,
      title,
      tenderNumber,
      tenderingAuthority,
      estimatedValueRupees,
      submissionDeadline,
      locationState,
      status: 'DRAFT',
      totalRequirements: 0,
      flaggedRequirements: 0,
      approvedRequirements: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(schema.auditLogs).values({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId: newBidId,
      organizationId: orgId,
      userId,
      userName: userId === 'usr_bid_mgr_01' ? 'Vikramaditya Sharma' : 'Authorized User',
      eventType: 'BID_PROJECT_CREATED',
      aggregateType: 'BidProject',
      aggregateId: newBidId,
      payload: { title, tenderNumber },
      timestamp: now,
    });

    return {
      id: newBidId,
      title,
      tenderNumber,
      tenderingAuthority,
      estimatedValueRupees,
      submissionDeadline,
      locationState,
      status: 'DRAFT',
      totalRequirements: 0,
      flaggedRequirements: 0,
      approvedRequirements: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      documents: [],
    };
  }

  public async deleteBid(
    bidId: string,
    organizationId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001',
  ): Promise<DeleteBidResult> {
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';
    // 1. Verify existence and tenant boundary (Anti-IDOR)
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, organizationId)))
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    // 2. Query documents belonging to this bid
    const docs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(and(eq(schema.tenderDocuments.bidId, bidId), eq(schema.tenderDocuments.organizationId, organizationId)));

    // 3. Record audit log before deletion
    const now = new Date();
    await this.db.insert(schema.auditLogs).values({
      id: `aud-del-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId,
      userId,
      userName: userId === 'usr_bid_mgr_01' ? 'Vikramaditya Sharma' : 'Authorized User',
      eventType: 'BID_PROJECT_DELETED',
      aggregateType: 'BidProject',
      aggregateId: bidId,
      payload: {
        title: bid.title,
        tenderNumber: bid.tenderNumber,
        documentsDeleted: docs.length,
        documentFiles: docs.map((d) => d.fileName),
      },
      timestamp: now,
    });

    // 4. Delete the bid from PostgreSQL (cascades to tender_documents and compliance_items)
    await this.db
      .delete(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, organizationId)));

    // 5. Delete cloud storage prefix (tenants/{orgId}/bids/{bidId}/)
    if (this.storageService) {
      const prefix = `tenants/${organizationId}/bids/${bidId}/`;
      try {
        await this.storageService.deletePrefix(prefix);
      } catch (err) {
        console.warn(`[BidsService] Failed to clean up cloud storage prefix ${prefix}:`, err);
      }
    }

    return {
      success: true,
      deletedBidId: bidId,
      deletedDocumentsCount: docs.length,
    };
  }

  private mapBidRecord(b: schema.Bid, documents: DemoDocument[]): DemoBid {
    return {
      id: b.id,
      title: b.title,
      tenderNumber: b.tenderNumber,
      tenderingAuthority: b.tenderingAuthority,
      estimatedValueRupees: Number(b.estimatedValueRupees),
      submissionDeadline: b.submissionDeadline,
      locationState: b.locationState,
      status: b.status,
      totalRequirements: b.totalRequirements,
      flaggedRequirements: b.flaggedRequirements,
      approvedRequirements: b.approvedRequirements,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
      updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
      documents,
    };
  }
}
