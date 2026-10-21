/**
 * AuditModule — Audit trail feature module.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { AuditController } from '@/modules/audit/audit.controller.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { AuditRepository } from '@/modules/audit/audit.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
