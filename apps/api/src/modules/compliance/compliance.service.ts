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
    const records = await this.db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.bidId, bidId))
      .orderBy(asc(schema.complianceItems.createdAt));

    return records.map((row) => this.mapComplianceRecord(row));
  }

  public async getItemById(bidId: string, itemId: string): Promise<DemoComplianceItem> {
    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(and(eq(schema.complianceItems.bidId, bidId), eq(schema.complianceItems.id, itemId)))
      .limit(1);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    return this.mapComplianceRecord(item);
  }

  public async reviewItem(
    bidId: string,
    itemId: string,
    dto: ReviewComplianceDto,
  ): Promise<ReviewComplianceResult> {
    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(and(eq(schema.complianceItems.bidId, bidId), eq(schema.complianceItems.id, itemId)))
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
    const reviewer = 'Vikramaditya Sharma';
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
      .where(eq(schema.complianceItems.id, itemId));

    // Recalculate summary metrics on bid in PostgreSQL
    const allItems = await this.db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.bidId, bidId));

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
      .where(eq(schema.bids.id, bidId));

    // Record audit event in PostgreSQL
    await this.db.insert(schema.auditLogs).values({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId: 'org_acme_infra_001',
      userId: 'usr_bid_mgr_01',
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
