/**
 * BillingModule — NestJS module grouping billing, subscription, and entitlement services.
 */
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { EntitlementService } from './entitlement.service.js';
import { MockBillingAdapter } from './mock-billing.adapter.js';
import { BILLING_PORT } from './billing.port.js';

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
