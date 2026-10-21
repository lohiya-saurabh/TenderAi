/**
 * BidsQueries — Query object dedicated to read-only queries, projections, aggregations,
 * and multi-table joins for bid projects.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import type { IStorageService } from '@/modules/bids/application/IStorageService.js';
import {
  fetchBidsWithRelations,
  resolveBidDocuments,
  type ListBidsQuery,
  type BidWithDecision,
  type PaginatedBidsResult,
} from './application/bids-query.builder.js';

@Injectable()
export class BidsQueries {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async listBids(
    orgId: string,
    query?: ListBidsQuery,
  ): Promise<PaginatedBidsResult | BidWithDecision[]> {
    return fetchBidsWithRelations(this.db, orgId, query);
  }

  async findBidById(bidId: string, orgId?: string): Promise<schema.Bid | null> {
    const [bidRecord] = await this.db
      .select()
      .from(schema.bids)
      .where(
        orgId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    return bidRecord ?? null;
  }

  async resolveDocuments(
    bidId: string,
    orgId: string,
    storageService?: IStorageService | null,
  ) {
    return resolveBidDocuments(this.db, bidId, orgId, storageService);
  }

  async listAllBidsByOrg(orgId: string): Promise<schema.Bid[]> {
    return this.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, orgId));
  }

  async listCorrigendumDocuments(orgId: string): Promise<schema.TenderDocument[]> {
    return this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.organizationId, orgId),
          eq(schema.tenderDocuments.documentType, 'CORRIGENDUM'),
        ),
      )
      .orderBy(desc(schema.tenderDocuments.uploadedAt));
  }

  async listComplianceItemsByOrg(orgId: string): Promise<schema.ComplianceItem[]> {
    return this.db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.organizationId, orgId));
  }

  async findLatestDecision(bidId: string, orgId: string): Promise<schema.BidDecision | null> {
    const [record] = await this.db
      .select()
      .from(schema.bidDecisions)
      .where(
        and(eq(schema.bidDecisions.bidId, bidId), eq(schema.bidDecisions.organizationId, orgId)),
      )
      .orderBy(desc(schema.bidDecisions.createdAt))
      .limit(1);

    return record ?? null;
  }

  async listComplianceItemsByBid(bidId: string, orgId: string): Promise<schema.ComplianceItem[]> {
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

  async findActiveCompanyProfileVersion(
    orgId: string,
    targetCompanyId?: string | null,
  ): Promise<{
    pointer: schema.CompanyProfile | null;
    profileVersion: schema.CompanyProfileVersion | null;
  }> {
    const pointerCondition = targetCompanyId
      ? and(
          eq(schema.companyProfiles.organizationId, orgId),
          eq(schema.companyProfiles.companyId, targetCompanyId),
        )
      : eq(schema.companyProfiles.organizationId, orgId);

    const [pointer] = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(pointerCondition)
      .limit(1);

    if (!pointer) {
      return { pointer: null, profileVersion: null };
    }

    const [profileVersion] = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(
        and(
          eq(schema.companyProfileVersions.id, pointer.activeVersionId),
          eq(schema.companyProfileVersions.organizationId, orgId),
        ),
      )
      .limit(1);

    return { pointer, profileVersion: profileVersion ?? null };
  }

  async listDocumentIdsByBid(bidId: string, orgId: string): Promise<Array<{ id: string }>> {
    return this.db
      .select({ id: schema.tenderDocuments.id })
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      );
  }

  async listCompanyEvidenceWithChunks(
    orgId: string,
    targetCompId: string,
  ): Promise<{
    evidenceDocuments: schema.CompanyEvidenceDocument[];
    evidenceChunks: schema.CompanyEvidenceChunk[];
  }> {
    const evidenceDocuments = await this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
          eq(schema.companyEvidenceDocuments.companyId, targetCompId),
        ),
      )
      .orderBy(desc(schema.companyEvidenceDocuments.createdAt));

    const evidenceChunks = await this.db
      .select()
      .from(schema.companyEvidenceChunks)
      .where(
        and(
          eq(schema.companyEvidenceChunks.organizationId, orgId),
          eq(schema.companyEvidenceChunks.companyId, targetCompId),
        ),
      )
      .orderBy(desc(schema.companyEvidenceChunks.createdAt));

    return { evidenceDocuments, evidenceChunks };
  }
}
