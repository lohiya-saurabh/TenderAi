/**
 * ComplianceModule — Compliance item management feature module.
 */
import { Module } from '@nestjs/common';
import { ComplianceController } from '@/modules/compliance/compliance.controller.js';
import { ComplianceService } from '@/modules/compliance/compliance.service.js';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
