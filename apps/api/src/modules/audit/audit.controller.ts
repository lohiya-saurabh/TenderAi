/**
 * AuditController — NestJS controller for audit trail endpoints.
 */
import { Controller, Get, Param } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { RequirePermission } from '../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../common/security/permissions.js';

@Controller('api/v1/bids/:bidId/audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission(Permissions.AUDIT_READ)
  async list(@Param('bidId') bidId: string) {
    return this.auditService.listEvents(bidId);
  }
}
