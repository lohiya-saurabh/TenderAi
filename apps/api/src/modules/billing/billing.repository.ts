import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql, and } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class BillingRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findSubscriptionByOrganization(
    organizationId: string,
  ): Promise<schema.Subscription | null> {
    const [sub] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, organizationId))
      .limit(1);

    return sub ?? null;
  }

  public async createSubscription(
    newSub: schema.NewSubscription,
  ): Promise<schema.Subscription | null> {
    const [created] = await this.db
      .insert(schema.subscriptions)
      .values(newSub)
      .onConflictDoNothing()
      .returning();

    return created ?? null;
  }

  public async updateSubscription(
    id: string,
    updates: Partial<schema.NewSubscription>,
  ): Promise<void> {
    await this.db
      .update(schema.subscriptions)
      .set(updates)
      .where(eq(schema.subscriptions.id, id));
  }

  public async countActiveCompanies(organizationId: string): Promise<number> {
    const compCountRes = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, organizationId));

    return parseInt(compCountRes[0]?.count || '0', 10);
  }

  public async countActiveUsers(organizationId: string): Promise<number> {
    const userCountRes = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.organizationId, organizationId));

    return parseInt(userCountRes[0]?.count || '0', 10);
  }

  public async sumTenderAnalysisUsage(
    organizationId: string,
    periodKey: string,
  ): Promise<number> {
    const usageRes = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.usageRecords.quantity}), 0)` })
      .from(schema.usageRecords)
      .where(
        and(
          eq(schema.usageRecords.organizationId, organizationId),
          eq(schema.usageRecords.metric, 'TENDER_ANALYSIS'),
          eq(schema.usageRecords.periodKey, periodKey),
        ),
      );

    return parseInt(usageRes[0]?.total || '0', 10);
  }

  public async recordUsage(usageRecord: schema.NewUsageRecord): Promise<void> {
    await this.db.insert(schema.usageRecords).values(usageRecord);
  }
}
