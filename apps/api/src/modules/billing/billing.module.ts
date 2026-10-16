/**
 * BillingModule — NestJS module grouping billing, subscription, and entitlement services.
 */
import { Module } from '@nestjs/common';
import { BillingController } from '@/modules/billing/billing.controller.js';
import { BillingService } from '@/modules/billing/billing.service.js';
import { EntitlementService } from '@/modules/billing/entitlement.service.js';
import { MockBillingAdapter } from '@/modules/billing/mock-billing.adapter.js';
import { BILLING_PORT } from '@/modules/billing/billing.port.js';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    EntitlementService,
    {
      provide: BILLING_PORT,
      useClass: MockBillingAdapter,
    },
  ],
  exports: [BillingService, EntitlementService, BILLING_PORT],
})
export class BillingModule {}
