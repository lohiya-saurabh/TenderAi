/**
 * DocumentsQueries — Read-only aggregations, lookups, joins, and outbox scanning for Documents module.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, asc, or, lte } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class DocumentsQueries {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async findBidById(bidId: string, orgId?: string): Promise<schema.Bid | null> {
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(
        orgId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    return bid ?? null;
  }

  async findDocumentById(docId: string, orgId?: string): Promise<schema.TenderDocument | null> {
    const [doc] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        orgId
          ? and(
              eq(schema.tenderDocuments.id, docId),
              eq(schema.tenderDocuments.organizationId, orgId),
            )
          : eq(schema.tenderDocuments.id, docId),
      )
      .limit(1);

    return doc ?? null;
  }

  async findDocumentWithBid(
    docId: string,
    orgId: string,
  ): Promise<{ document: schema.TenderDocument; bid: schema.Bid } | null> {
    const [source] = await this.db
      .select({
        document: schema.tenderDocuments,
        bid: schema.bids,
      })
      .from(schema.tenderDocuments)
      .innerJoin(
        schema.bids,
        and(
          eq(schema.tenderDocuments.bidId, schema.bids.id),
          eq(schema.tenderDocuments.organizationId, schema.bids.organizationId),
        ),
      )
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    return source ?? null;
  }

  async listDocumentsByBid(bidId: string, orgId: string): Promise<schema.TenderDocument[]> {
    return this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.tenderDocuments.uploadedAt));
  }

  async listComplianceItemsByBid(
    bidId: string,
    orgId: string,
  ): Promise<schema.ComplianceItem[]> {
    return this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );
  }

  async getBidAndDocsStatus(
    bidId: string,
    orgId: string,
  ): Promise<{
    bidStatus: string | null;
    docs: Array<{ status: string }>;
  }> {
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

    return {
      bidStatus: bid?.status ?? null,
      docs,
    };
  }

  async getOrgIdForBid(bidId: string): Promise<string | null> {
    const [bid] = await this.db
      .select({ organizationId: schema.bids.organizationId })
      .from(schema.bids)
      .where(eq(schema.bids.id, bidId))
      .limit(1);

    return bid?.organizationId ?? null;
  }

  async findPendingOutboxMessages(
    now: Date,
    staleLease: Date,
    limit = 10,
  ): Promise<schema.DocumentProcessingOutboxRecord[]> {
    return this.db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(
        or(
          and(
            eq(schema.documentProcessingOutbox.status, 'PENDING'),
            lte(schema.documentProcessingOutbox.nextAttemptAt, now),
          ),
          and(
            eq(schema.documentProcessingOutbox.status, 'PUBLISHING'),
            lte(schema.documentProcessingOutbox.lockedAt, staleLease),
          ),
        ),
      )
      .limit(limit);
  }
}
