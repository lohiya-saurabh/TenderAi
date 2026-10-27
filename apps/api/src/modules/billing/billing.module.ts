/**
 * BillingModule — NestJS module grouping billing, subscription, and entitlement services.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { BillingController } from '@/modules/billing/billing.controller.js';
import { BillingService } from '@/modules/billing/billing.service.js';
import { EntitlementService } from '@/modules/billing/entitlement.service.js';
import { BillingRepository } from '@/modules/billing/billing.repository.js';
import { MockBillingAdapter } from '@/modules/billing/mock-billing.adapter.js';
import { BILLING_PORT } from '@/modules/billing/billing.port.js';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    EntitlementService,
    BillingRepository,
    {
      provide: BILLING_PORT,
      useClass: MockBillingAdapter,
    },
  ],
  exports: [BillingService, EntitlementService, BillingRepository, BILLING_PORT],
})
export class BillingModule {}
