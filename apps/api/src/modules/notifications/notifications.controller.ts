/**
 * NotificationsController — REST endpoints for user notifications & alerts.
 */
import { Controller, Get, Post, Patch, Param, Query, Body, HttpCode } from '@nestjs/common';
import { NotificationsService } from '@/modules/notifications/notifications.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';
import type { SendNotificationDto } from '@/modules/notifications/notifications.types.js';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async listNotifications(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const isUnreadOnly = unreadOnly === 'true';
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.notificationsService.listNotifications({
      unreadOnly: isUnreadOnly,
      limit: parsedLimit,
    });
  }

  @Patch(':id/read')
  @RequirePermission(Permissions.BIDS_READ)
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('mark-all-read')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_READ)
  async markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Post('trigger-scan')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_READ)
  async triggerScan() {
    return this.notificationsService.triggerDeadlineAndExpiryScan();
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permissions.BIDS_CREATE)
  async sendNotification(@Body() body: SendNotificationDto) {
    return this.notificationsService.sendNotification(body);
  }
}
