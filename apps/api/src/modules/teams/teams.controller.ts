/**
 * TeamsController — Endpoints for managing team members within a Tenant.
 */
import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { TeamsService, type InviteMemberDto } from '@/modules/teams/teams.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('members')
  @RequirePermission(Permissions.BIDS_READ)
  async listMembers() {
    return this.teamsService.listMembers();
  }

  @Post('invite')
  @HttpCode(201)
  @RequirePermission(Permissions.ORG_USERS_MANAGE)
  async inviteMember(@Body() body: InviteMemberDto) {
    return this.teamsService.inviteMember(body);
  }
}
