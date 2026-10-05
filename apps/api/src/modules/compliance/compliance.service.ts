/**
 * ComplianceService — CRUD + review operations for compliance items.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { NotFoundError, ConflictError } from '../../common/errors/errors.js';
import type { DemoComplianceItem } from '../../seed/data.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

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

@Injectable()
export class ComplianceService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listItems(bidId: string): Promise<DemoComplianceItem[]> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const records = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.complianceItems.createdAt));

    return records.map((row) => this.mapComplianceRecord(row));
  }

  public async getItemById(bidId: string, itemId: string): Promise<DemoComplianceItem> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    return this.mapComplianceRecord(item);
  }

  /**
   * Review tasks — real projection of the compliance
   * matrix: requirements awaiting human action
   * (status PENDING or explicitly flagged
   * humanReviewRequired). No separate task aggregate
   * exists yet; this is the honest derivation from
   * stored review state.
   */
  public async listReviewTasks(
    bidId: string,
  ): Promise<DemoComplianceItem[]> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const records = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.complianceItems.createdAt));

    return records
      .filter((row) => row.status === 'PENDING' || row.humanReviewRequired)
      .map((row) => this.mapComplianceRecord(row));
  }

  /**
   * Bid readiness rollup — server-side computation
   * over the requirement matrix. pct is null when
   * nothing is extracted (pending intake, not 0%).
   */
  public async getReadinessRollup(
    bidId: string,
  ): Promise<{
    totalRequirements: number;
    ready: number;
    flagged: number;
    pending: number;
    waived: number;
    reviewRequired: number;
    reviewNeeded: number;
    readinessPct: number | null;
  }> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const records = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    const total = records.length;
    const ready = records.filter((r) => r.status === 'READY').length;
    const flagged = records.filter((r) => r.status === 'FLAGGED').length;
    const pending = records.filter((r) => r.status === 'PENDING').length;
    const waived = records.filter((r) => r.status === 'WAIVED').length;
    const reviewRequired = records.filter((r) => r.humanReviewRequired).length;

    return {
      totalRequirements: total,
      ready,
      flagged,
      pending,
      waived,
      reviewRequired,
      reviewNeeded: pending + reviewRequired,
      readinessPct: total > 0 ? Math.round((ready / total) * 100) : null,
    };
  }

  public async reviewItem(
    bidId: string,
    itemId: string,
    dto: ReviewComplianceDto,
  ): Promise<ReviewComplianceResult> {
    const orgId = TenantContextHolder.get()?.organizationId || 'org_acme_infra_001';
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';
    const reviewer = userId === 'usr_bid_mgr_01' ? 'Vikramaditya Sharma' : 'Reviewer';

    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    // Optimistic concurrency check
    if (dto.expectedVersion != null && item.version !== dto.expectedVersion) {
      throw new ConflictError(
        `Conflict: Item has been modified by another reviewer (Version ${item.version}). Please refresh.`,
      );
    }

    const validStatuses: DemoComplianceItem['status'][] = ['PENDING', 'READY', 'FLAGGED', 'WAIVED'];
    const newStatus =
      typeof dto.status === 'string' && (validStatuses as string[]).includes(dto.status)
        ? (dto.status as DemoComplianceItem['status'])
        : (item.status as DemoComplianceItem['status']);
    const newNotes =
      typeof dto.notes === 'string' ? dto.notes : dto.notes === null ? null : item.reviewNotes;
    const now = new Date();
    const nextVersion = item.version + 1;

    await this.db
      .update(schema.complianceItems)
      .set({
        status: newStatus,
        reviewNotes: newNotes,
        reviewedBy: reviewer,
        reviewedAt: now,
        version: nextVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    // Recalculate summary metrics on bid in PostgreSQL
    const allItems = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    const approvedCount = allItems.filter((i) =>
      i.id === itemId ? newStatus === 'READY' : i.status === 'READY',
    ).length;
    const flaggedCount = allItems.filter((i) =>
      i.id === itemId ? newStatus === 'FLAGGED' : i.status === 'FLAGGED',
    ).length;
    const totalCount = allItems.length;

    await this.db
      .update(schema.bids)
      .set({
        approvedRequirements: approvedCount,
        flaggedRequirements: flaggedCount,
        totalRequirements: totalCount,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bids.id, bidId),
          eq(schema.bids.organizationId, orgId),
        ),
      );

    // Record audit event in PostgreSQL
    await this.db.insert(schema.auditLogs).values({
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

  private mapComplianceRecord(record: schema.ComplianceItem): DemoComplianceItem {
    const executionRules =
      typeof record.executionRules === 'string'
        ? JSON.parse(record.executionRules)
        : (record.executionRules as DemoComplianceItem['executionRules']);
    const provenance =
      typeof record.provenance === 'string'
        ? JSON.parse(record.provenance)
        : (record.provenance as DemoComplianceItem['provenance']);

    return {
      id: record.id,
      bidId: record.bidId,
      category: record.category as DemoComplianceItem['category'],
      title: record.title,
      description: record.description,
      status: record.status as DemoComplianceItem['status'],
      humanReviewRequired: record.humanReviewRequired,
      reviewNotes: record.reviewNotes,
      reviewedBy: record.reviewedBy,
      reviewedAt:
        record.reviewedAt instanceof Date
          ? record.reviewedAt.toISOString()
          : record.reviewedAt
            ? String(record.reviewedAt)
            : null,
      version: record.version,
      executionRules,
      provenance,
      createdAt:
        record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
      updatedAt:
        record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    };
  }
}
