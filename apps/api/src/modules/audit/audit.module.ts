/**
 * AuditModule — Audit trail feature module.
 */
import { Module } from '@nestjs/common';
import { AuditController } from '@/modules/audit/audit.controller.js';
import { AuditService } from '@/modules/audit/audit.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
