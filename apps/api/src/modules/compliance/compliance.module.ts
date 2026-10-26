/**
 * ComplianceModule — Compliance item management feature module.
 */
import { Module } from '@nestjs/common';
import { ComplianceController } from '@/modules/compliance/compliance.controller.js';
import { ComplianceService } from '@/modules/compliance/compliance.service.js';
import { ComplianceRepository } from '@/modules/compliance/compliance.repository.js';
import { ClausesController } from '@/modules/compliance/clauses.controller.js';
import { ClausesService } from '@/modules/compliance/clauses.service.js';
import { ClausesRepository } from '@/modules/compliance/clauses.repository.js';

@Module({
  controllers: [ComplianceController, ClausesController],
  providers: [ComplianceService, ComplianceRepository, ClausesService, ClausesRepository],
  exports: [ComplianceService, ComplianceRepository],
})
export class ComplianceModule {}
