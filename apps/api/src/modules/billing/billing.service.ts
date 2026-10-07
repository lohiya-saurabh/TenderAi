/**
 * BillingService — Handles tenant subscription management, plan catalog, and usage metering.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql, and } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { BadRequestError } from '../../common/errors/errors.js';
import {
  PLAN_CATALOG,
  type PlanTier,
  type BillingInterval,
  type SubscriptionView,
  type UsageSummary,
  type ChangePlanDto,
  type PlanDefinition,
} from './billing.types.js';

@Injectable()
export class BillingService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Returns all available product pricing plans.
   */
  public getPlans(): PlanDefinition[] {
    return Object.values(PLAN_CATALOG);
  }

  /**
   * Get the active subscription for a tenant workspace.
   */
  public async getSubscription(organizationId: string): Promise<SubscriptionView> {
    const [sub] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, organizationId))
      .limit(1);

    if (sub) {
      const tier = (sub.planTier?.toUpperCase() || 'FREE') as PlanTier;
      const planDef = PLAN_CATALOG[tier] || PLAN_CATALOG.FREE;
      const interval = (sub.billingInterval?.toUpperCase() || 'MONTHLY') as BillingInterval;
      const price = interval === 'ANNUAL' ? planDef.annualMonthlyPriceInr : planDef.monthlyPriceInr;

      return {
        id: sub.id,
        organizationId: sub.organizationId,
        planTier: planDef.tier,
        planName: planDef.name,
        billingInterval: interval,
        status: sub.status as any,
        currentPeriodStart: sub.currentPeriodStart instanceof Date ? sub.currentPeriodStart.toISOString() : String(sub.currentPeriodStart),
        currentPeriodEnd: sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd.toISOString() : String(sub.currentPeriodEnd),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        entitlements: planDef.entitlements,
        priceInr: price,
      };
    }

    // Default auto-provisioned FREE subscription for tenants without an explicit record
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await this.db
      .insert(schema.subscriptions)
      .values({
        id: subId,
        organizationId,
        planTier: 'FREE',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .onConflictDoNothing();

    const freePlan = PLAN_CATALOG.FREE;
    return {
      id: subId,
      organizationId,
      planTier: 'FREE',
      planName: freePlan.name,
      billingInterval: 'MONTHLY',
      status: 'ACTIVE',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      entitlements: freePlan.entitlements,
      priceInr: 0,
    };
  }

  /**
   * Get current usage numbers against plan limits for a tenant.
   */
  public async getUsageSummary(organizationId: string): Promise<UsageSummary> {
    const sub = await this.getSubscription(organizationId);
    const entitlements = sub.entitlements;

    // Active companies count
    const compCountRes = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, organizationId));
    const activeCompanies = parseInt(compCountRes[0]?.count || '0', 10);

    // Active users count
    const userCountRes = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.organizationId, organizationId));
    const activeUsers = parseInt(userCountRes[0]?.count || '0', 10);

    // Current month analyses
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
    const monthlyAnalyses = parseInt(usageRes[0]?.total || '0', 10);

    return {
      activeCompanies,
      maxCompanies: entitlements['companies.max'],
      activeUsers,
      maxUsers: entitlements['users.max'],
      monthlyAnalyses,
      maxMonthlyAnalyses: entitlements['tender_analyses.monthly'],
      periodKey,
      entitlements,
    };
  }

  /**
   * Upgrade / downgrade or switch billing cycle for a tenant subscription.
   */
  public async changePlan(organizationId: string, dto: ChangePlanDto): Promise<SubscriptionView> {
    const targetTier = dto.planTier?.toUpperCase() as PlanTier;
    if (!PLAN_CATALOG[targetTier]) {
      throw new BadRequestError(`Invalid plan tier "${dto.planTier}". Valid tiers: FREE, STARTER, GROWTH, BUSINESS, ENTERPRISE`);
    }

    const interval = (dto.billingInterval?.toUpperCase() || 'MONTHLY') as BillingInterval;
    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    const [existing] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, organizationId))
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.subscriptions)
        .set({
          planTier: targetTier,
          billingInterval: interval,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(schema.subscriptions.id, existing.id));
    } else {
      await this.db
        .insert(schema.subscriptions)
        .values({
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          organizationId,
          planTier: targetTier,
          billingInterval: interval,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
    }

    return this.getSubscription(organizationId);
  }
}
