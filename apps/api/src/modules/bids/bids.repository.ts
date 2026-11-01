/**
 * BidsRepository — Encapsulates database mutations, domain persistence, and tenant-scoped lookups for bids.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class BidsRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
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

  async findCompany(companyId: string, orgId: string): Promise<schema.Company | null> {
    const [comp] = await this.db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .limit(1);

    return comp ?? null;
  }

  async findDefaultCompany(orgId: string): Promise<schema.Company | null> {
    const [comp] = await this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .limit(1);

    return comp ?? null;
  }

  async createBid(data: typeof schema.bids.$inferInsert): Promise<void> {
    await this.db.insert(schema.bids).values(data);
  }

  async createAuditLog(data: typeof schema.auditLogs.$inferInsert): Promise<void> {
    await this.db.insert(schema.auditLogs).values(data);
  }

  async findDocumentsByBid(bidId: string, orgId: string): Promise<schema.TenderDocument[]> {
    return this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      );
  }

  async deleteBid(bidId: string, orgId: string): Promise<void> {
    await this.db
      .delete(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));
  }

  async createBidDecision(data: typeof schema.bidDecisions.$inferInsert): Promise<void> {
    await this.db.insert(schema.bidDecisions).values(data);
  }
}
