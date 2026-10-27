/**
 * EntitlementService — Evaluates and enforces plan-based capability limits for Tenants.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { ForbiddenError } from '@/common/errors/errors.js';
import { PLAN_CATALOG, type PlanTier, type PlanEntitlements } from '@/modules/billing/billing.types.js';
import { BillingRepository } from '@/modules/billing/billing.repository.js';

@Injectable()
export class EntitlementService {
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
   * Get the active plan tier for a tenant.
   */
  public async getPlanTier(organizationId: string): Promise<PlanTier> {
    const sub = await this.repository.findSubscriptionByOrganization(organizationId);

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

    const currentCount = await this.repository.countActiveCompanies(organizationId);

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

    const currentCount = await this.repository.countActiveUsers(organizationId);

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

    const currentUsage = await this.repository.sumTenderAnalysisUsage(organizationId, periodKey);

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

    await this.repository.recordUsage({
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      metric: 'TENDER_ANALYSIS',
      quantity: 1,
      periodKey,
    });
  }
}
