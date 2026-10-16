/**
 * BidsService — CRUD operations for bid projects against PostgreSQL.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import { STORAGE_TOKEN } from '@/infrastructure/storage/storage.module.js';
import type { IStorageService } from '@/modules/bids/application/IStorageService.js';
import * as schema from '@/common/database/schema.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';
import type { DemoBid } from '@/seed/data.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import {
  fetchBidsWithRelations,
  mapBidRecord,
  resolveBidDocuments,
  type ListBidsQuery,
  type BidDecisionProjection,
  type BidWithDecision,
  type PaginatedBidsResult,
} from './application/bids-query.builder.js';
import {
  calculateTenderDeadlines,
  type TenderDeadlinesResult,
  type TenderMilestone,
} from './application/tender-deadlines.calculator.js';
import {
  calculateDashboardMetrics,
  type DashboardMetricsResult,
} from './application/bid-metrics.calculator.js';
import {
  buildTenderAmendments,
  type TenderAmendmentItem,
  type TenderAmendmentsResult,
} from './application/tender-amendments.service.js';

export interface CreateBidDto {
  companyId?: string;
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

export type {
  ListBidsQuery,
  BidDecisionProjection,
  BidWithDecision,
  PaginatedBidsResult,
  TenderMilestone,
  TenderDeadlinesResult,
  DashboardMetricsResult,
  TenderAmendmentItem,
  TenderAmendmentsResult,
};

@Injectable()
export class BidsService {
  private readonly db: DrizzleDb;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Optional() @Inject(STORAGE_TOKEN) private readonly storageService?: IStorageService | null,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listBids(query?: ListBidsQuery): Promise<PaginatedBidsResult | BidWithDecision[]> {
    const orgId = TenantContextHolder.get()?.organizationId || '';
    return fetchBidsWithRelations(this.db, orgId, query);
  }

  public async getBidById(bidId: string): Promise<DemoBid> {
    const orgId = TenantContextHolder.get()?.organizationId;
    const [bidRecord] = await this.db
      .select()
      .from(schema.bids)
      .where(
        orgId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    if (!bidRecord) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const finalOrgId = orgId || bidRecord.organizationId;
    const documents = await resolveBidDocuments(
      this.db,
      bidId,
      finalOrgId,
      this.storageService,
    );
    return mapBidRecord(bidRecord, documents);
  }

  public async createBid(dto: CreateBidDto): Promise<DemoBid> {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant organization context is required to create a bid.');
    }
    const userId = TenantContextHolder.get()?.userId || 'usr_admin';
    const newBidId = `bid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const title =
      typeof dto.title === 'string' && dto.title.trim() ? dto.title.trim() : 'Untitled Tender';
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
    const submissionDeadline =
      typeof dto.submissionDeadline === 'string' ? dto.submissionDeadline : null;
    const locationState =
      typeof dto.locationState === 'string' && dto.locationState.trim()
        ? dto.locationState.trim()
        : null;

    let companyId = dto.companyId?.trim();
    if (companyId) {
      const [comp] = await this.db
        .select()
        .from(schema.companies)
        .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
        .limit(1);

      if (!comp) {
        throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
      }
    } else {
      const [defaultComp] = await this.db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.organizationId, orgId))
        .limit(1);

      if (!defaultComp) {
        throw new BadRequestError(
          'No company entity found for this organization. Every organization must have at least one company.',
        );
      }
      companyId = defaultComp.id;
    }

    const now = new Date();

    await this.db.insert(schema.bids).values({
      id: newBidId,
      organizationId: orgId,
      companyId: companyId!,
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
      companyId: companyId!,
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
    organizationId = TenantContextHolder.get()?.organizationId || '',
  ): Promise<DeleteBidResult> {
    const userId = TenantContextHolder.get()?.userId || 'usr_admin';
    // 1. Verify existence and tenant boundary (Anti-IDOR)
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(
        organizationId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, organizationId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    // 2. Query documents belonging to this bid
    const docs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, organizationId),
        ),
      );

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

  /**
   * Calculates comprehensive tender lifecycle milestone deadlines for a bid.
   */
  public async getTenderDeadlines(bidId: string): Promise<TenderDeadlinesResult> {
    const orgId = TenantContextHolder.get()?.organizationId;
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(
        orgId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    return calculateTenderDeadlines(bid);
  }

  /**
   * Pre-aggregated tenant KPIs and pipeline analytics.
   */
  public async getDashboardMetrics(): Promise<DashboardMetricsResult> {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      return {
        activePipelineCount: 0,
        totalPipelineValueRupees: 0,
        totalFlaggedRequirements: 0,
        imminentDeadlinesCount: 0,
        pipelineDistribution: {
          DRAFT: 0,
          ANALYZING: 0,
          REVIEW_READY: 0,
          SUBMITTED: 0,
          ARCHIVED: 0,
        },
        totalTendersCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    const allBids = await this.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, orgId));

    return calculateDashboardMetrics(allBids);
  }

  /**
   * Corrigendum / amendment notification and impact stream across monitored tenders.
   */
  public async getTenderAmendments(bidIdFilter?: string): Promise<TenderAmendmentsResult> {
    const orgId = TenantContextHolder.get()?.organizationId || '';
    if (!orgId) {
      return {
        organizationId: '',
        totalAmendments: 0,
        unreadCount: 0,
        amendments: [],
      };
    }

    const allBids = await this.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, orgId));

    const corrDocs = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.organizationId, orgId),
          eq(schema.tenderDocuments.documentType, 'CORRIGENDUM'),
        ),
      )
      .orderBy(desc(schema.tenderDocuments.uploadedAt));

    const allCompliance = await this.db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.organizationId, orgId));

    return buildTenderAmendments(orgId, allBids, corrDocs, allCompliance, bidIdFilter);
  }
}

