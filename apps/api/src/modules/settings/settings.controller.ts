/**
 * SettingsController — Endpoints for workspace settings and notification preferences.
 */
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SettingsService, type UpdateWorkspaceSettingsDto } from '@/modules/settings/settings.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('workspace')
  @RequirePermission(Permissions.BIDS_READ)
  async getWorkspaceSettings() {
    return this.settingsService.getWorkspaceSettings();
  }

  @Patch('workspace')
  @RequirePermission(Permissions.ORG_MANAGE)
  async updateWorkspaceSettings(@Body() body: UpdateWorkspaceSettingsDto) {
    return this.settingsService.updateWorkspaceSettings(body);
  }
}
