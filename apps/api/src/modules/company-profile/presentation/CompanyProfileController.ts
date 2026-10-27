/**
 * CompanyProfileController — Company Capability Profile
 * management endpoints.
 *
 * GET is available to any role that can read bids (the
 * profile is required to interpret bid decisions).
 * POST (pinning a new version) is restricted to
 * COMPANY_PROFILE_MANAGE (ADMIN) because the profile is
 * the factual basis of every bid/no-bid verdict.
 *
 * @deprecated These tenant-global routes silently resolve the
 * organisation's first company. Use the entity-scoped routes under
 * `/api/v1/companies/:companyId/profile` instead. Responses carry
 * an RFC 9745 `Deprecation` header and every call is logged so
 * remaining callers can be found before the routes are removed.
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  Injectable,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { BadRequestError } from '@/common/errors/errors.js';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';
import type { CompanyProfilePayload } from '@/modules/company-profile/presentation/dto/CompanyProfilePayload.js';

/** Deprecation date (2026-10-26T00:00:00Z) as an RFC 9745 structured-field date. */
const DEPRECATED_SINCE = '@1792972800';

@Injectable()
class LegacyCompanyProfileDeprecationInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger('CompanyProfileController', 'api');

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    res.setHeader('Deprecation', DEPRECATED_SINCE);
    this.logger.warn(`Deprecated route called: ${req.method} ${req.originalUrl ?? req.url}`);
    return next.handle();
  }
}

@Controller('api/v1/company-profile')
@UseInterceptors(LegacyCompanyProfileDeprecationInterceptor)
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
  async createVersion(@Body() body: { name?: string; payload?: CompanyProfilePayload }) {
    if (!body.payload) {
      throw new BadRequestError('Request body must include a "payload" object.');
    }
    return this.companyProfileService.createProfileVersion(body.name ?? '', body.payload);
  }
}
