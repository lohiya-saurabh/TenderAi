/**
 * SettingsModule — NestJS module for workspace configuration and preferences.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { SettingsService } from './settings.service.js';
import { SettingsController } from './settings.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
