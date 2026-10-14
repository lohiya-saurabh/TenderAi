/**
 * EntitlementService — Evaluates and enforces plan-based capability limits for Tenants.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql, and } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { ForbiddenError } from '../../common/errors/errors.js';
import { PLAN_CATALOG, type PlanTier, type PlanEntitlements } from './billing.types.js';

@Injectable()
export class EntitlementService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Get the active plan tier for a tenant.
   */
  public async getPlanTier(organizationId: string): Promise<PlanTier> {
    const [sub] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.organizationId, organizationId))
      .limit(1);

    if (!sub || sub.status !== 'ACTIVE') {
      return 'FREE';
    }

    const tier = (sub.planTier?.toUpperCase() || 'FREE') as PlanTier;
    return PLAN_CATALOG[tier] ? tier : 'FREE';
  }

  /**
   * Get the full entitlement matrix for a tenant.
   */
  public async getEntitlements(organizationId: string): Promise<PlanEntitlements> {
    const tier = await this.getPlanTier(organizationId);
    return PLAN_CATALOG[tier].entitlements;
  }

  /**
   * Validate if the tenant can add another Company.
   */
  public async checkCompanyLimit(organizationId: string): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId);
    const maxAllowed = entitlements['companies.max'];

    const countResult = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, organizationId));

    const currentCount = parseInt(countResult[0]?.count || '0', 10);

    if (currentCount >= maxAllowed) {
      const currentTier = await this.getPlanTier(organizationId);
      throw new ForbiddenError(
        `Your ${currentTier} plan allows up to ${maxAllowed} company entity (${currentCount} registered). Please upgrade your workspace plan to add additional companies.`,
      );
    }
  }

  /**
   * Validate if the tenant can invite another User.
   */
  public async checkUserLimit(organizationId: string): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId);
    const maxAllowed = entitlements['users.max'];

    const countResult = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.organizationId, organizationId));

    const currentCount = parseInt(countResult[0]?.count || '0', 10);

    if (currentCount >= maxAllowed) {
      const currentTier = await this.getPlanTier(organizationId);
      throw new ForbiddenError(
        `Your ${currentTier} plan allows up to ${maxAllowed} team members (${currentCount} active). Please upgrade your workspace plan to invite more users.`,
      );
    }
  }

  /**
   * Validate if the tenant can perform another tender analysis this month.
   */
  public async checkTenderAnalysisLimit(organizationId: string): Promise<void> {
    const entitlements = await this.getEntitlements(organizationId);
    const maxAllowed = entitlements['tender_analyses.monthly'];

    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const countResult = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.usageRecords.quantity}), 0)` })
      .from(schema.usageRecords)
      .where(
        and(
          eq(schema.usageRecords.organizationId, organizationId),
          eq(schema.usageRecords.metric, 'TENDER_ANALYSIS'),
          eq(schema.usageRecords.periodKey, periodKey),
        ),
      );

    const currentUsage = parseInt(countResult[0]?.total || '0', 10);

    if (currentUsage >= maxAllowed) {
      const currentTier = await this.getPlanTier(organizationId);
      throw new ForbiddenError(
        `Monthly tender analysis limit of ${maxAllowed} reached for ${periodKey} on your ${currentTier} plan. Please upgrade to Growth or Business for higher volume.`,
      );
    }
  }

  /**
   * Record a metered analysis usage event.
   */
  public async recordAnalysisUsage(organizationId: string): Promise<void> {
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await this.db.insert(schema.usageRecords).values({
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      metric: 'TENDER_ANALYSIS',
      quantity: 1,
      periodKey,
    });
  }
}
