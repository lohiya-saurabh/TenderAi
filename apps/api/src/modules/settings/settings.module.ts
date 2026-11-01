/**
 * SettingsModule — NestJS module for tenant workspace configuration.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { SettingsService } from '@/modules/settings/settings.service.js';
import { SettingsRepository } from '@/modules/settings/settings.repository.js';
import { SettingsController } from '@/modules/settings/settings.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService, SettingsRepository],
})
export class SettingsModule {}
