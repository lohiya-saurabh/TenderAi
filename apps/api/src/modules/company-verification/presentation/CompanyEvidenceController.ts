/**
 * CompanyEvidenceController — REST endpoints for company evidence document onboarding & management.
 *
 * Enforces Zero-Trust TenantContextHolder isolation and Anti-IDOR boundary validation.
 */
import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode } from '@nestjs/common';
import { CompanyEvidenceService } from '../application/CompanyEvidenceService.js';
import { GoogleDriveConnector } from '../infrastructure/GoogleDriveConnector.js';
import { OneDriveConnector } from '../infrastructure/OneDriveConnector.js';
import { RequirePermission } from '../../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../../common/security/permissions.js';
import { BadRequestError } from '../../../common/errors/errors.js';

export interface UploadEvidenceRequestBody {
  fileName: string;
  fileBase64: string;
  mimeType?: string;
  evidenceType: string;
  issuer?: string;
  referenceNumber?: string;
  validFrom?: string;
  validTo?: string;
  extractedAttributes?: Record<string, unknown>;
}

export interface ImportCloudRequestBody {
  provider: 'google-drive' | 'onedrive';
  fileId: string;
  fileName?: string;
  evidenceType: string;
  issuer?: string;
  referenceNumber?: string;
  validFrom?: string;
  validTo?: string;
  authContext?: Record<string, unknown>;
}

@Controller('api/v1/companies/:companyId/evidence')
export class CompanyEvidenceController {
  constructor(
    private readonly companyEvidenceService: CompanyEvidenceService,
    private readonly googleDriveConnector: GoogleDriveConnector,
    private readonly oneDriveConnector: OneDriveConnector,
  ) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async listEvidence(@Param('companyId') companyId: string) {
    return this.companyEvidenceService.listEvidence(companyId);
  }

  @Post('upload')
  @HttpCode(201)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async uploadEvidence(
    @Param('companyId') companyId: string,
    @Body() body: UploadEvidenceRequestBody,
  ) {
    if (!body.fileName || !body.fileBase64) {
      throw new BadRequestError('fileName and fileBase64 are required.');
    }

    const buffer = Buffer.from(body.fileBase64, 'base64');
    return this.companyEvidenceService.uploadEvidence(companyId, {
      fileName: body.fileName,
      buffer,
      mimeType: body.mimeType || 'application/pdf',
      evidenceType: body.evidenceType || 'OTHER',
      issuer: body.issuer,
      referenceNumber: body.referenceNumber,
      validFrom: body.validFrom,
      validTo: body.validTo,
      extractedAttributes: body.extractedAttributes,
    });
  }

  @Get('cloud-files')
  @RequirePermission(Permissions.BIDS_READ)
  async listCloudFiles(
    @Query('provider') provider: 'google-drive' | 'onedrive',
    @Query('folderId') folderId?: string,
  ) {
    const connector = provider === 'onedrive' ? this.oneDriveConnector : this.googleDriveConnector;
    return connector.listFiles(undefined, folderId);
  }

  @Post('import-cloud')
  @HttpCode(201)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async importCloudEvidence(
    @Param('companyId') companyId: string,
    @Body() body: ImportCloudRequestBody,
  ) {
    if (!body.provider || !body.fileId) {
      throw new BadRequestError('provider and fileId are required.');
    }
    return this.companyEvidenceService.importFromCloudSource(companyId, body);
  }

  @Get(':evidenceId')
  @RequirePermission(Permissions.BIDS_READ)
  async getEvidenceById(
    @Param('companyId') companyId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.companyEvidenceService.getEvidenceById(companyId, evidenceId);
  }

  @Delete(':evidenceId')
  @HttpCode(204)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async deleteEvidence(
    @Param('companyId') companyId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    await this.companyEvidenceService.deleteEvidence(companyId, evidenceId);
  }

  @Post(':evidenceId/extract')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async extractEvidence(
    @Param('companyId') companyId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.companyEvidenceService.extractAndPersistChunks(companyId, evidenceId);
  }
}
