/**
 * ComplianceModule — Compliance item management feature module.
 */
import { Module } from '@nestjs/common';
import { ComplianceController } from '@/modules/compliance/compliance.controller.js';
import { ComplianceService } from '@/modules/compliance/compliance.service.js';
import { ComplianceRepository } from '@/modules/compliance/compliance.repository.js';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceRepository],
  exports: [ComplianceService, ComplianceRepository],
})
export class ComplianceModule {}
