/**
 * TendersController — tenant-wide tender intelligence & amendment feed.
 */
import { Controller, Get, Query } from '@nestjs/common';
import { BidsService } from '@/modules/bids/bids.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/tenders')
export class TendersController {
  constructor(private readonly bidsService: BidsService) {}

  @Get('amendments')
  @RequirePermission(Permissions.BIDS_READ)
  async getAmendments(@Query('bidId') bidId?: string) {
    return this.bidsService.getTenderAmendments(bidId);
  }
}
