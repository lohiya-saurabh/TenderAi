/**
 * CompaniesService — Manages business legal entities (Companies) within a Tenant.
 *
 * Implements 1 Tenant -> N Companies scoping with strict anti-IDOR validation.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { EntitlementService } from '@/modules/billing/entitlement.service.js';
import type { CompanyProfilePayload } from '@/modules/company-profile/presentation/dto/CompanyProfilePayload.js';
import { CompaniesRepository } from '@/modules/companies/companies.repository.js';

export interface CreateCompanyDto {
  legalName: string;
  slug?: string;
  gstin?: string;
  pan?: string;
  udyamId?: string;
  constitution?: string;
}

export const TURNOVER_BANDS = [
  'under_10_cr',
  '10_to_50_cr',
  '50_to_250_cr',
  'above_250_cr',
] as const;

export type TurnoverBand = (typeof TURNOVER_BANDS)[number];

/**
 * Self-declared answers captured by the onboarding wizard. These are
 * hints for UI personalisation only: they are not evidence and are
 * never written into the capability profile the evaluator reads.
 */
export interface OnboardingPreferences {
  sectors: string[];
  turnoverBand: TurnoverBand;
  completedAt: string;
}

export interface UpdateOnboardingPreferencesDto {
  sectors?: unknown;
  turnoverBand?: unknown;
}

const MAX_ONBOARDING_SECTORS = 20;
const MAX_SECTOR_LENGTH = 120;

export interface CompanyView {
  id: string;
  organizationId: string;
  legalName: string;
  slug: string | null;
  gstin: string | null;
  pan: string | null;
  cin?: string | null;
  udyamId: string | null;
  constitution: string | null;
  gstinVerifiedAt?: string | null;
  gstinVerificationData?: Record<string, unknown> | null;
  mcaVerifiedAt?: string | null;
  mcaVerificationData?: Record<string, unknown> | null;
  udyamVerifiedAt?: string | null;
  udyamVerificationData?: Record<string, unknown> | null;
  digilockerLinkedAt?: string | null;
  digilockerMetadata?: Record<string, unknown> | null;
  onboardingPreferences?: OnboardingPreferences | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CompaniesService {
  private readonly repository: CompaniesRepository;

  constructor(
    @Inject(CompaniesRepository)
    repositoryOrDb: CompaniesRepository | DrizzleDb | PGlite,
    @Inject(CompanyProfileService)
    private readonly companyProfileService: CompanyProfileService,
    @Optional()
    @Inject(EntitlementService)
    private readonly entitlementService?: EntitlementService,
  ) {
    this.repository =
      repositoryOrDb instanceof CompaniesRepository
        ? repositoryOrDb
        : new CompaniesRepository(repositoryOrDb);
  }

  /**
   * List all companies belonging to the caller's tenant.
   */
  public async listCompanies(): Promise<CompanyView[]> {
    const orgId = this.requireOrg();

    const records = await this.repository.listCompaniesByOrganization(orgId);

    return records.map((r) => this.mapCompany(r));
  }

  /**
   * Get a single company by ID, verifying tenant ownership (Anti-IDOR).
   */
  public async getCompanyById(companyId: string): Promise<CompanyView> {
    const orgId = this.requireOrg();

    const record = await this.repository.findCompanyById(companyId, orgId);

    if (!record) {
      throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
    }

    return this.mapCompany(record);
  }

  /**
   * Create a new company under the caller's tenant.
   */
  public async createCompany(dto: CreateCompanyDto): Promise<CompanyView> {
    const orgId = this.requireOrg();

    if (!dto.legalName || !dto.legalName.trim()) {
      throw new BadRequestError('Company "legalName" is required.');
    }

    // Enforce Tenant Plan Entitlements
    if (this.entitlementService) {
      await this.entitlementService.checkCompanyLimit(orgId);
    }

    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const created = await this.repository.createCompany({
      id: companyId,
      organizationId: orgId,
      legalName: dto.legalName.trim(),
      slug: dto.slug?.trim() ?? null,
      gstin: dto.gstin?.trim() ?? null,
      pan: dto.pan?.trim() ?? null,
      udyamId: dto.udyamId?.trim() ?? null,
      constitution: dto.constitution?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });

    if (!created) {
      throw new BadRequestError('Failed to create company record.');
    }

    return this.mapCompany(created);
  }

  /**
   * Get capability profile for a specific company (Anti-IDOR).
   */
  public async getCompanyProfile(companyId: string) {
    // Validate tenant ownership
    await this.getCompanyById(companyId);
    return this.companyProfileService.getProfile(companyId);
  }

  /**
   * Pin a new capability profile version for a specific company (Anti-IDOR).
   */
  public async createCompanyProfileVersion(
    companyId: string,
    name: string,
    payload: CompanyProfilePayload,
  ) {
    // Validate tenant ownership
    await this.getCompanyById(companyId);
    return this.companyProfileService.createProfileVersion(name, payload, companyId);
  }

  /**
   * Fetch a specific pinned profile version for a company (Anti-IDOR).
   */
  public async getCompanyProfileVersion(companyId: string, versionId: string) {
    await this.getCompanyById(companyId);
    return this.companyProfileService.getVersionById(versionId, companyId);
  }

  /**
   * Store the onboarding wizard's self-declared answers on the company (Anti-IDOR).
   */
  public async updateOnboardingPreferences(
    companyId: string,
    dto: UpdateOnboardingPreferencesDto,
  ): Promise<CompanyView> {
    const orgId = this.requireOrg();
    await this.getCompanyById(companyId);

    const { sectors, turnoverBand } = dto ?? {};
    if (
      !Array.isArray(sectors) ||
      sectors.length > MAX_ONBOARDING_SECTORS ||
      sectors.some((s) => typeof s !== 'string' || !s.trim() || s.trim().length > MAX_SECTOR_LENGTH)
    ) {
      throw new BadRequestError(
        `"sectors" must be an array of at most ${MAX_ONBOARDING_SECTORS} non-empty strings (max ${MAX_SECTOR_LENGTH} chars each).`,
      );
    }
    if (
      typeof turnoverBand !== 'string' ||
      !TURNOVER_BANDS.includes(turnoverBand as TurnoverBand)
    ) {
      throw new BadRequestError(`"turnoverBand" must be one of: ${TURNOVER_BANDS.join(', ')}.`);
    }

    const now = new Date();
    const preferences: OnboardingPreferences = {
      sectors: [...new Set((sectors as string[]).map((s) => s.trim()))],
      turnoverBand: turnoverBand as TurnoverBand,
      completedAt: now.toISOString(),
    };

    const updated = await this.repository.updateCompany(companyId, orgId, {
      onboardingPreferences: preferences,
      updatedAt: now,
    });

    if (!updated) {
      throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
    }
    return this.mapCompany(updated);
  }

  /**
   * Get expiring certificates for a specific company (Anti-IDOR).
   */
  public async getCompanyExpiringCertificates(companyId: string, withinDays = 90) {
    // Validate tenant ownership
    await this.getCompanyById(companyId);
    return this.companyProfileService.getExpiringCertificates(withinDays, companyId);
  }

  private mapCompany(r: schema.Company): CompanyView {
    return {
      id: r.id,
      organizationId: r.organizationId,
      legalName: r.legalName,
      slug: r.slug,
      gstin: r.gstin,
      pan: r.pan,
      cin: r.cin ?? null,
      udyamId: r.udyamId,
      constitution: r.constitution,
      gstinVerifiedAt: r.gstinVerifiedAt
        ? r.gstinVerifiedAt instanceof Date
          ? r.gstinVerifiedAt.toISOString()
          : String(r.gstinVerifiedAt)
        : null,
      gstinVerificationData: (r.gstinVerificationData as Record<string, unknown>) ?? null,
      mcaVerifiedAt: r.mcaVerifiedAt
        ? r.mcaVerifiedAt instanceof Date
          ? r.mcaVerifiedAt.toISOString()
          : String(r.mcaVerifiedAt)
        : null,
      mcaVerificationData: (r.mcaVerificationData as Record<string, unknown>) ?? null,
      udyamVerifiedAt: r.udyamVerifiedAt
        ? r.udyamVerifiedAt instanceof Date
          ? r.udyamVerifiedAt.toISOString()
          : String(r.udyamVerifiedAt)
        : null,
      udyamVerificationData: (r.udyamVerificationData as Record<string, unknown>) ?? null,
      digilockerLinkedAt: r.digilockerLinkedAt
        ? r.digilockerLinkedAt instanceof Date
          ? r.digilockerLinkedAt.toISOString()
          : String(r.digilockerLinkedAt)
        : null,
      digilockerMetadata: (r.digilockerMetadata as Record<string, unknown>) ?? null,
      onboardingPreferences: (r.onboardingPreferences as OnboardingPreferences | null) ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required to access company resources.');
    }
    return orgId;
  }
}
