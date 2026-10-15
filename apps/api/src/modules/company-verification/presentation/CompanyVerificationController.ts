/**
 * CompanyVerificationController — REST endpoints for third-party identity and registry verification.
 *
 * Exposes:
 * - POST /api/v1/companies/:companyId/verification/gstin (IRIS IRP GSTIN verification)
 * - POST /api/v1/companies/:companyId/verification/mca (MCA CIN verification)
 * - POST /api/v1/companies/:companyId/verification/udyam (MSME Udyam verification)
 * - GET  /api/v1/companies/:companyId/verification/digilocker/authorize (OAuth consent start)
 * - POST /api/v1/companies/:companyId/verification/digilocker/callback (OAuth code exchange & doc import)
 * - GET  /api/v1/companies/:companyId/verification/history (Audit trail)
 * - POST /api/v1/companies/:companyId/verification/review-discrepancy (Human review action)
 */
import { Controller, Get, Post, Param, Body, Query, HttpCode } from '@nestjs/common';
import { EvidenceVerificationService } from '@/modules/company-verification/application/EvidenceVerificationService.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';
import { BadRequestError } from '@/common/errors/errors.js';

@Controller('api/v1/companies/:companyId/verification')
export class CompanyVerificationController {
  constructor(private readonly verificationService: EvidenceVerificationService) {}

  @Post('gstin')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async verifyGstin(@Param('companyId') companyId: string, @Body() body: { gstin?: string }) {
    if (!body.gstin || !body.gstin.trim()) {
      throw new BadRequestError('gstin parameter is required.');
    }
    return this.verificationService.verifyGstin(companyId, body.gstin);
  }

  @Post('mca')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async verifyMca(@Param('companyId') companyId: string, @Body() body: { cin?: string }) {
    if (!body.cin || !body.cin.trim()) {
      throw new BadRequestError('cin parameter is required.');
    }
    return this.verificationService.verifyMca(companyId, body.cin);
  }

  @Post('udyam')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async verifyUdyam(@Param('companyId') companyId: string, @Body() body: { udyamNumber?: string }) {
    if (!body.udyamNumber || !body.udyamNumber.trim()) {
      throw new BadRequestError('udyamNumber parameter is required.');
    }
    return this.verificationService.verifyUdyam(companyId, body.udyamNumber);
  }

  @Get('digilocker/authorize')
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async authorizeDigiLocker(
    @Param('companyId') companyId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const defaultRedirect = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/company-profile?tab=evidence&digilocker=callback`;
    return this.verificationService.generateDigiLockerAuth(
      companyId,
      redirectUri || defaultRedirect,
    );
  }

  @Post('digilocker/callback')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async handleDigiLockerCallback(
    @Param('companyId') companyId: string,
    @Body() body: { code: string; state: string; redirectUri?: string },
  ) {
    if (!body.code || !body.state) {
      throw new BadRequestError('code and state are required.');
    }
    const defaultRedirect = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/company-profile?tab=evidence&digilocker=callback`;
    return this.verificationService.handleDigiLockerCallback(
      companyId,
      body.code,
      body.state,
      body.redirectUri || defaultRedirect,
    );
  }

  @Get('history')
  @RequirePermission(Permissions.BIDS_READ)
  async getVerificationHistory(@Param('companyId') companyId: string) {
    return this.verificationService.getVerificationHistory(companyId);
  }

  @Post('review-discrepancy')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPANY_PROFILE_MANAGE)
  async reviewDiscrepancy(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      evidenceDocumentId: string;
      decision: 'ACCEPT_REGISTRY' | 'OVERRIDE_MANUAL' | 'REJECT';
      notes?: string;
    },
  ) {
    if (!body.evidenceDocumentId || !body.decision) {
      throw new BadRequestError('evidenceDocumentId and decision are required.');
    }
    return this.verificationService.reviewDiscrepancy(
      companyId,
      body.evidenceDocumentId,
      body.decision,
      body.notes || '',
    );
  }
}
