/**
 * ComplianceController — NestJS controller for compliance item endpoints.
 */
import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ComplianceService } from './compliance.service.js';
import type { DemoComplianceItem } from '../../seed/data.js';

@Controller('api/v1/bids/:bidId/compliance-items')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get()
  async list(@Param('bidId') bidId: string) {
    return this.complianceService.listItems(bidId);
  }

  @Get(':itemId')
  async getById(@Param('bidId') bidId: string, @Param('itemId') itemId: string) {
    return this.complianceService.getItemById(bidId, itemId);
  }

  @Patch(':itemId')
  async patchItem(
    @Param('bidId') bidId: string,
    @Param('itemId') itemId: string,
    @Body() body: { status?: DemoComplianceItem['status']; notes?: string | null; expectedVersion?: number },
  ) {
    return this.complianceService.reviewItem(bidId, itemId, {
      status: body.status,
      notes: body.notes,
      expectedVersion: body.expectedVersion,
    });
  }
}
