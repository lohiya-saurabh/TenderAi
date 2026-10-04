/**
 * AuditController — NestJS controller for audit trail endpoints.
 */
import { Controller, Get, Param } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Controller('api/v1/bids/:bidId/audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(@Param('bidId') bidId: string) {
    return this.auditService.listEvents(bidId);
  }
}
