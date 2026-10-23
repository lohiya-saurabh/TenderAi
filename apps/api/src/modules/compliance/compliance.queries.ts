import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

export interface ReadinessRollupData {
  totalRequirements: number;
  ready: number;
  flagged: number;
  pending: number;
  waived: number;
  reviewRequired: number;
  reviewNeeded: number;
  readinessPct: number | null;
}

export class ComplianceQueries {
  constructor(private readonly db: DrizzleDb) {}

  async listReviewTasks(bidId: string, orgId: string): Promise<schema.ComplianceItem[]> {
    return this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
          sql`(${schema.complianceItems.status} IN ('PENDING', 'REVIEW_REQUIRED') OR ${schema.complianceItems.humanReviewRequired} = true)`,
        ),
      )
      .orderBy(asc(schema.complianceItems.createdAt));
  }

  async getReadinessRollup(bidId: string, orgId: string): Promise<ReadinessRollupData> {
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        ready: sql<number>`count(*) filter (where ${schema.complianceItems.status} in ('READY', 'PASS'))::int`,
        flagged: sql<number>`count(*) filter (where ${schema.complianceItems.status} in ('FLAGGED', 'FAIL'))::int`,
        pending: sql<number>`count(*) filter (where ${schema.complianceItems.status} in ('PENDING', 'MISSING'))::int`,
        waived: sql<number>`count(*) filter (where ${schema.complianceItems.status} in ('WAIVED', 'NOT_APPLICABLE'))::int`,
        reviewRequired: sql<number>`count(*) filter (where ${schema.complianceItems.status} = 'REVIEW_REQUIRED' or ${schema.complianceItems.humanReviewRequired} = true)::int`,
      })
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    const total = stats?.total ?? 0;
    const ready = stats?.ready ?? 0;
    const flagged = stats?.flagged ?? 0;
    const pending = stats?.pending ?? 0;
    const waived = stats?.waived ?? 0;
    const reviewRequired = stats?.reviewRequired ?? 0;

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

  async findBidById(bidId: string, orgId: string): Promise<schema.Bid | null> {
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);
    return bid ?? null;
  }

  async findLatestBidDecision(bidId: string, orgId: string): Promise<schema.BidDecision | null> {
    const [decision] = await this.db
      .select()
      .from(schema.bidDecisions)
      .where(
        and(eq(schema.bidDecisions.bidId, bidId), eq(schema.bidDecisions.organizationId, orgId)),
      )
      .orderBy(desc(schema.bidDecisions.createdAt))
      .limit(1);
    return decision ?? null;
  }
}
