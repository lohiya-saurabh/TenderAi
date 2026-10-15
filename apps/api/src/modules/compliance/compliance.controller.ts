/**
 * ComplianceController — NestJS controller for compliance item endpoints.
 */
import { Controller, Get, Patch, Param, Body, Inject } from '@nestjs/common';
import { ComplianceService } from '@/modules/compliance/compliance.service.js';
import type { DemoComplianceItem } from '@/seed/data.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/bids/:bidId/compliance-items')
export class ComplianceController {
  constructor(@Inject(ComplianceService) private readonly complianceService: ComplianceService) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async list(@Param('bidId') bidId: string) {
    return this.complianceService.listItems(bidId);
  }

  @Get(':itemId')
  @RequirePermission(Permissions.BIDS_READ)
  async getById(@Param('bidId') bidId: string, @Param('itemId') itemId: string) {
    return this.complianceService.getItemById(bidId, itemId);
  }

  @Patch('bulk')
  @RequirePermission(Permissions.COMPLIANCE_REVIEW)
  async bulkReview(
    @Param('bidId') bidId: string,
    @Body()
    body: {
      items: Array<{
        id: string;
        status: DemoComplianceItem['status'];
        notes?: string | null;
        expectedVersion?: number;
      }>;
    },
  ) {
    return this.complianceService.bulkReviewItems(bidId, body.items || []);
  }

  @Patch(':itemId')
  @RequirePermission(Permissions.COMPLIANCE_REVIEW)
  async patchItem(
    @Param('bidId') bidId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      status?: DemoComplianceItem['status'];
      notes?: string | null;
      expectedVersion?: number;
    },
  ) {
    return this.complianceService.reviewItem(bidId, itemId, {
      status: body.status,
      notes: body.notes,
      expectedVersion: body.expectedVersion,
    });
  }
}
