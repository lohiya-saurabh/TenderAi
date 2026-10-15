/**
 * TeamsModule — NestJS module for team members and invitations.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { BillingModule } from '@/modules/billing/billing.module.js';
import { TeamsService } from '@/modules/teams/teams.service.js';
import { TeamsController } from '@/modules/teams/teams.controller.js';

@Module({
  imports: [DatabaseModule, BillingModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
