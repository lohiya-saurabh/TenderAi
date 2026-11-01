/**
 * TeamsModule — NestJS module for team members and invitations.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { TeamsService } from '@/modules/teams/teams.service.js';
import { TeamsRepository } from '@/modules/teams/teams.repository.js';
import { TeamsController } from '@/modules/teams/teams.controller.js';
import { BillingModule } from '@/modules/billing/billing.module.js';

@Module({
  imports: [DatabaseModule, BillingModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService, TeamsRepository],
})
export class TeamsModule {}
