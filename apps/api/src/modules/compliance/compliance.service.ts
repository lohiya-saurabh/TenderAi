/**
 * ComplianceService — CRUD + review operations for compliance items.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { NotFoundError, ConflictError } from '@/common/errors/errors.js';
import type { DemoComplianceItem } from '@/seed/data.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import {
  mapComplianceRecord,
  deduplicateComplianceItems,
} from './application/compliance-item.mapper.js';
import {
  buildEvidenceMatches,
  type EvidenceMatchItem,
  type EvidenceMatchesResult,
} from './application/evidence-matches.projection.js';
import {
  buildRiskFindings,
  type StatutoryRiskItem,
  type CommercialRiskItem,
  type RiskFindingsResult,
} from './application/compliance-risk.calculator.js';
import { ComplianceRepository } from './compliance.repository.js';
import { ComplianceQueries } from './compliance.queries.js';

export interface ReviewComplianceDto {
  status?: DemoComplianceItem['status'];
  notes?: string | null;
  expectedVersion?: number;
}

export interface ReviewComplianceResult {
  id: string;
  status: DemoComplianceItem['status'];
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
}

export type {
  EvidenceMatchItem,
  EvidenceMatchesResult,
  StatutoryRiskItem,
  CommercialRiskItem,
  RiskFindingsResult,
};

@Injectable()
export class ComplianceService {
  private readonly repository: ComplianceRepository;
  private readonly queries: ComplianceQueries;

  constructor(
    @Inject(ComplianceRepository)
    repoOrDb: ComplianceRepository | DrizzleDb | PGlite,
  ) {
    if (repoOrDb instanceof ComplianceRepository) {
      this.repository = repoOrDb;
      this.queries = new ComplianceQueries(repoOrDb.getDb());
    } else {
      this.repository = new ComplianceRepository(repoOrDb);
      this.queries = new ComplianceQueries(this.repository.getDb());
    }
  }

  /**
   * Resolves tenant organization ID from authenticated JWT context.
   * If TenantContext is missing (e.g. unauthenticated test harness), falls back to 'org_default'.
   */
  private getTenantOrgId(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (orgId) return orgId;
    return 'org_default';
  }

  public async listItems(bidId: string): Promise<DemoComplianceItem[]> {
    const orgId = this.getTenantOrgId();
    const records = await this.repository.listItemsByBidId(bidId, orgId);
    const deduped = deduplicateComplianceItems(records);
    return deduped.map((row) => mapComplianceRecord(row));
  }

  public async getItemById(bidId: string, itemId: string): Promise<DemoComplianceItem> {
    const orgId = this.getTenantOrgId();
    const item = await this.repository.findItemById(bidId, itemId, orgId);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    return mapComplianceRecord(item);
  }

  /**
   * Review tasks — real projection of the compliance matrix:
   * requirements awaiting human action (status PENDING, REVIEW_REQUIRED, or humanReviewRequired).
   */
  public async listReviewTasks(bidId: string): Promise<DemoComplianceItem[]> {
    const orgId = this.getTenantOrgId();
    const records = await this.queries.listReviewTasks(bidId, orgId);
    const deduped = deduplicateComplianceItems(records);
    return deduped.map((row) => mapComplianceRecord(row));
  }

  /**
   * Bid readiness rollup — server-side computation over the requirement matrix.
   */
  public async getReadinessRollup(bidId: string): Promise<{
    totalRequirements: number;
    ready: number;
    flagged: number;
    pending: number;
    waived: number;
    reviewRequired: number;
    reviewNeeded: number;
    readinessPct: number | null;
  }> {
    const orgId = this.getTenantOrgId();
    return this.queries.getReadinessRollup(bidId, orgId);
  }

  /**
   * Evidence cross-matching projection for a bid.
   * Maps extracted tender requirements to company-side proof documents.
   */
  public async getEvidenceMatches(bidId: string): Promise<EvidenceMatchesResult> {
    const orgId = this.getTenantOrgId();
    const bid = await this.queries.findBidById(bidId, orgId);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const items = await this.listItems(bidId);
    return buildEvidenceMatches(bidId, items);
  }

  /**
   * Consolidated statutory, execution, and commercial risk radar for a bid.
   */
  public async getRiskFindings(bidId: string): Promise<RiskFindingsResult> {
    const orgId = this.getTenantOrgId();
    const bid = await this.queries.findBidById(bidId, orgId);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const mappedItems = await this.listItems(bidId);
    const decisionRecord = await this.queries.findLatestBidDecision(bidId, orgId);

    return buildRiskFindings(bid.id, bid.tenderNumber, mappedItems, decisionRecord);
  }

  public async reviewItem(
    bidId: string,
    itemId: string,
    dto: ReviewComplianceDto,
  ): Promise<ReviewComplianceResult> {
    const orgId = this.getTenantOrgId();
    const userId = TenantContextHolder.get()?.userId || 'usr_reviewer';
    const reviewer = 'Reviewer';

    const item = await this.repository.findItemById(bidId, itemId, orgId);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    // Optimistic concurrency check
    if (dto.expectedVersion != null && item.version !== dto.expectedVersion) {
      throw new ConflictError(
        `Conflict: Item has been modified by another reviewer (Version ${item.version}). Please refresh.`,
      );
    }

    const validStatuses: DemoComplianceItem['status'][] = [
      'PENDING',
      'READY',
      'FLAGGED',
      'WAIVED',
      'PASS',
      'FAIL',
      'MISSING',
      'REVIEW_REQUIRED',
      'NOT_APPLICABLE',
    ];
    const newStatus =
      typeof dto.status === 'string' && (validStatuses as string[]).includes(dto.status)
        ? (dto.status as DemoComplianceItem['status'])
        : (item.status as DemoComplianceItem['status']);
    const newNotes =
      typeof dto.notes === 'string' ? dto.notes : dto.notes === null ? null : item.reviewNotes;
    const now = new Date();
    const nextVersion = item.version + 1;

    // If human reviewed with PASS/READY/WAIVED/NOT_APPLICABLE, resolve humanReviewRequired
    const isResolved =
      newStatus === 'PASS' ||
      newStatus === 'READY' ||
      newStatus === 'WAIVED' ||
      newStatus === 'NOT_APPLICABLE';

    await this.repository.updateItemReview(itemId, orgId, {
      status: newStatus,
      reviewNotes: newNotes,
      reviewedBy: reviewer,
      reviewedAt: now,
      humanReviewRequired: isResolved ? false : item.humanReviewRequired,
      version: nextVersion,
      updatedAt: now,
    });

    // Recalculate summary metrics on bid in PostgreSQL
    const allItems = await this.repository.listItemsByBidId(bidId, orgId);

    const approvedCount = allItems.filter((i) => {
      const st = i.id === itemId ? newStatus : i.status;
      return st === 'READY' || st === 'PASS';
    }).length;
    const flaggedCount = allItems.filter((i) => {
      const st = i.id === itemId ? newStatus : i.status;
      return st === 'FLAGGED' || st === 'FAIL';
    }).length;
    const totalCount = allItems.length;

    await this.repository.updateBidMetrics(bidId, orgId, {
      approvedRequirements: approvedCount,
      flaggedRequirements: flaggedCount,
      totalRequirements: totalCount,
      updatedAt: now,
    });

    // Record audit event in PostgreSQL
    await this.repository.createAuditLog({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId: orgId,
      userId,
      userName: reviewer,
      eventType: `COMPLIANCE_ITEM_${newStatus}`,
      aggregateType: 'ComplianceItem',
      aggregateId: itemId,
      payload: {
        title: item.title,
        status: newStatus,
        notes: newNotes,
        version: nextVersion,
      },
      timestamp: now,
    });

    return {
      id: item.id,
      status: newStatus,
      reviewNotes: newNotes,
      reviewedBy: reviewer,
      reviewedAt: now.toISOString(),
      version: nextVersion,
    };
  }

  public async bulkReviewItems(
    bidId: string,
    items: Array<{
      id: string;
      status: DemoComplianceItem['status'];
      notes?: string | null;
      expectedVersion?: number;
    }>,
  ): Promise<ReviewComplianceResult[]> {
    const results: ReviewComplianceResult[] = [];
    for (const item of items) {
      const res = await this.reviewItem(bidId, item.id, {
        status: item.status,
        notes: item.notes,
        expectedVersion: item.expectedVersion,
      });
      results.push(res);
    }
    return results;
  }
}
