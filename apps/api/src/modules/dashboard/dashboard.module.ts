/**
 * DashboardModule — feature module for dashboard metrics.
 */
import { Module } from '@nestjs/common';
import { DashboardController } from '@/modules/dashboard/dashboard.controller.js';
import { BidsModule } from '@/modules/bids/bids.module.js';

@Module({
  imports: [BidsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
