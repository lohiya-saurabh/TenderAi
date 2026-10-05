/**
 * DashboardModule — feature module for dashboard metrics.
 */
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { BidsModule } from '../bids/bids.module.js';

@Module({
  imports: [BidsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
