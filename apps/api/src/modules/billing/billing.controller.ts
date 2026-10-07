import { Controller, Get, Post, Body } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { Public } from '../../common/security/decorators/public.decorator.js';
import { RequirePermission } from '../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../common/security/permissions.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { BadRequestError } from '../../common/errors/errors.js';
import type { ChangePlanDto } from './billing.types.js';

@Controller('api/v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * Public Plan Catalog — used on public /pricing and marketing pages.
   */
  @Public()
  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  /**
   * Tenant's Active Subscription.
   */
  @Get('subscription')
  async getSubscription() {
    const orgId = this.requireOrg();
    return this.billingService.getSubscription(orgId);
  }

  /**
   * Tenant's Current Usage & Limit Summary.
   */
  @Get('usage')
  async getUsage() {
    const orgId = this.requireOrg();
    return this.billingService.getUsageSummary(orgId);
  }

  /**
   * Upgrade or modify active plan (admin only).
   */
  @RequirePermission(Permissions.ORG_MANAGE)
  @Post('change-plan')
  async changePlan(@Body() body: ChangePlanDto) {
    const orgId = this.requireOrg();
    if (!body?.planTier) {
      throw new BadRequestError('Field "planTier" is required.');
    }
    return this.billingService.changePlan(orgId, body);
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context required for billing operations.');
    }
    return orgId;
  }
}
