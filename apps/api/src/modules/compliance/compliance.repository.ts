import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class ComplianceRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async listItemsByBidId(bidId: string, orgId: string): Promise<schema.ComplianceItem[]> {
    return this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.complianceItems.createdAt));
  }

  async findItemById(
    bidId: string,
    itemId: string,
    orgId: string,
  ): Promise<schema.ComplianceItem | null> {
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
    return item ?? null;
  }

  async updateItemReview(
    itemId: string,
    orgId: string,
    data: {
      status: string;
      reviewNotes: string | null;
      reviewedBy: string;
      reviewedAt: Date;
      humanReviewRequired?: boolean;
      version: number;
      updatedAt: Date;
    },
  ): Promise<void> {
    await this.db
      .update(schema.complianceItems)
      .set(data)
      .where(
        and(
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );
  }

  async updateBidMetrics(
    bidId: string,
    orgId: string,
    data: {
      approvedRequirements: number;
      flaggedRequirements: number;
      totalRequirements: number;
      updatedAt: Date;
    },
  ): Promise<void> {
    await this.db
      .update(schema.bids)
      .set(data)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));
  }

  async createAuditLog(entry: schema.NewAuditLog): Promise<void> {
    await this.db.insert(schema.auditLogs).values(entry);
  }
}
