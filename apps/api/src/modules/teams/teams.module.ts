/**
 * TeamsModule — NestJS module for team members and invitations.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { TeamsService } from './teams.service.js';
import { TeamsController } from './teams.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
