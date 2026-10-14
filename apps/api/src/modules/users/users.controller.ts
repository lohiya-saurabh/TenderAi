/**
 * UsersController — Endpoints for user profile and credentials.
 */
import { Controller, Get, Patch, Post, Body, HttpCode } from '@nestjs/common';
import {
  UsersService,
  type UpdateUserProfileDto,
  type ChangePasswordDto,
} from './users.service.js';
import { RequirePermission } from '../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../common/security/permissions.js';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @RequirePermission(Permissions.BIDS_READ)
  async getMe() {
    return this.usersService.getMe();
  }

  @Patch('me')
  @RequirePermission(Permissions.BIDS_READ)
  async updateMe(@Body() body: UpdateUserProfileDto) {
    return this.usersService.updateMe(body);
  }

  @Post('change-password')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_READ)
  async changePassword(@Body() body: ChangePasswordDto) {
    return this.usersService.changePassword(body);
  }
}
