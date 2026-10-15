/**
 * DashboardController — tenant-aggregated metrics and analytics.
 */
import { Controller, Get } from '@nestjs/common';
import { BidsService } from '@/modules/bids/bids.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly bidsService: BidsService) {}

  @Get('metrics')
  @RequirePermission(Permissions.BIDS_READ)
  async getMetrics() {
    return this.bidsService.getDashboardMetrics();
  }
}
