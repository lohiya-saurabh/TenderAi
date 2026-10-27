/**
 * CompaniesController — REST endpoints for managing Companies within a Tenant.
 *
 * All endpoints enforce TenantContextHolder isolation and anti-IDOR checks.
 */
import { Controller, Get, Post, Patch, Param, Query, Body, HttpCode } from '@nestjs/common';
import {
  CompaniesService,
  type CreateCompanyDto,
  type UpdateOnboardingPreferencesDto,
} from '@/modules/companies/companies.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';
import { BadRequestError } from '@/common/errors/errors.js';
import type { CompanyProfilePayload } from '@/modules/company-profile/presentation/dto/CompanyProfilePayload.js';

@Controller('api/v1/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async listCompanies() {
    return this.companiesService.listCompanies();
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async createCompany(@Body() body: CreateCompanyDto) {
    return this.companiesService.createCompany(body);
  }

  @Get(':id')
  @RequirePermission(Permissions.BIDS_READ)
  async getCompanyById(@Param('id') id: string) {
    return this.companiesService.getCompanyById(id);
  }

  @Get(':id/profile')
  @RequirePermission(Permissions.BIDS_READ)
  async getCompanyProfile(@Param('id') id: string) {
    return this.companiesService.getCompanyProfile(id);
  }

  @Post(':id/profile')
  @HttpCode(201)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async createCompanyProfileVersion(
    @Param('id') id: string,
    @Body() body: { name?: string; payload?: CompanyProfilePayload },
  ) {
    if (!body.payload) {
      throw new BadRequestError('Request body must include a "payload" object.');
    }
    return this.companiesService.createCompanyProfileVersion(id, body.name ?? '', body.payload);
  }

  @Get(':id/profile/versions/:versionId')
  @RequirePermission(Permissions.BIDS_READ)
  async getCompanyProfileVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.companiesService.getCompanyProfileVersion(id, versionId);
  }

  @Patch(':id/onboarding-preferences')
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async updateOnboardingPreferences(
    @Param('id') id: string,
    @Body() body: UpdateOnboardingPreferencesDto,
  ) {
    return this.companiesService.updateOnboardingPreferences(id, body);
  }

  @Get(':id/expiring-certificates')
  @RequirePermission(Permissions.BIDS_READ)
  async getCompanyExpiringCertificates(
    @Param('id') id: string,
    @Query('withinDays') withinDays?: string,
  ) {
    const parsed = withinDays ? parseInt(withinDays, 10) : 90;
    const days = Number.isNaN(parsed) ? 90 : parsed;
    return this.companiesService.getCompanyExpiringCertificates(id, days);
  }
}
