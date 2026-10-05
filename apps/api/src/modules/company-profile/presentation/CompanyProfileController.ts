/**
 * CompanyProfileController — Company Capability Profile
 * management endpoints.
 *
 * GET is available to any role that can read bids (the
 * profile is required to interpret bid decisions).
 * POST (pinning a new version) is restricted to
 * COMPANY_PROFILE_MANAGE (ADMIN) because the profile is
 * the factual basis of every bid/no-bid verdict.
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
} from '@nestjs/common';
import { BadRequestError } from '../../../common/errors/errors.js';
import { CompanyProfileService } from '../company-profile.service.js';
import { RequirePermission } from '../../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../../common/security/permissions.js';
import type { CompanyProfilePayload } from './dto/CompanyProfilePayload.js';

@Controller('api/v1/company-profile')
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async getProfile() {
    return this.companyProfileService.getProfile();
  }

  @Get('expiring-certificates')
  @RequirePermission(Permissions.BIDS_READ)
  async getExpiringCertificates(@Query('withinDays') withinDays?: string) {
    const parsed = withinDays ? parseInt(withinDays, 10) : 90;
    const days = Number.isNaN(parsed) ? 90 : parsed;
    return this.companyProfileService.getExpiringCertificates(days);
  }

  @Get('versions/:versionId')
  @RequirePermission(Permissions.BIDS_READ)
  async getVersion(@Param('versionId') versionId: string) {
    return this.companyProfileService.getVersionById(versionId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async createVersion(
    @Body() body: { name?: string; payload?: CompanyProfilePayload },
  ) {
    if (!body.payload) {
      throw new BadRequestError('Request body must include a "payload" object.');
    }
    return this.companyProfileService.createProfileVersion(
      body.name ?? '',
      body.payload,
    );
  }
}
