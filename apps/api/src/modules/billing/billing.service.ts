/**
 * BillingService — Handles tenant subscription management, plan catalog, and usage metering.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { BadRequestError } from '@/common/errors/errors.js';
import {
  PLAN_CATALOG,
  type PlanTier,
  type BillingInterval,
  type SubscriptionView,
  type UsageSummary,
  type ChangePlanDto,
  type PlanDefinition,
} from '@/modules/billing/billing.types.js';
import { BillingRepository } from '@/modules/billing/billing.repository.js';

@Injectable()
export class BillingService {
  private readonly repository: BillingRepository;

  constructor(
    @Inject(BillingRepository)
    repositoryOrDb: BillingRepository | DrizzleDb | PGlite,
  ) {
    this.repository =
      repositoryOrDb instanceof BillingRepository
        ? repositoryOrDb
        : new BillingRepository(repositoryOrDb);
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
    const sub = await this.repository.findSubscriptionByOrganization(organizationId);

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
        status: sub.status as SubscriptionView['status'],
        currentPeriodStart:
          sub.currentPeriodStart instanceof Date
            ? sub.currentPeriodStart.toISOString()
            : String(sub.currentPeriodStart),
        currentPeriodEnd:
          sub.currentPeriodEnd instanceof Date
            ? sub.currentPeriodEnd.toISOString()
            : String(sub.currentPeriodEnd),
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

    await this.repository.createSubscription({
      id: subId,
      organizationId,
      planTier: 'FREE',
      billingInterval: 'MONTHLY',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });

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
    const activeCompanies = await this.repository.countActiveCompanies(organizationId);

    // Active users count
    const activeUsers = await this.repository.countActiveUsers(organizationId);

    // Current month analyses
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyAnalyses = await this.repository.sumTenderAnalysisUsage(organizationId, periodKey);

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
      throw new BadRequestError(
        `Invalid plan tier "${dto.planTier}". Valid tiers: FREE, STARTER, GROWTH, BUSINESS, ENTERPRISE`,
      );
    }

    const interval = (dto.billingInterval?.toUpperCase() || 'MONTHLY') as BillingInterval;
    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    const existing = await this.repository.findSubscriptionByOrganization(organizationId);

    if (existing) {
      await this.repository.updateSubscription(existing.id, {
        planTier: targetTier,
        billingInterval: interval,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      });
    } else {
      await this.repository.createSubscription({
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
