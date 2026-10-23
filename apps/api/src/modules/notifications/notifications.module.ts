/**
 * NotificationsModule — Module for notifications and deadline alerts.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { NotificationsService } from '@/modules/notifications/notifications.service.js';
import { NotificationsController } from '@/modules/notifications/notifications.controller.js';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
