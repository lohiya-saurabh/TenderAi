/**
 * CompaniesService — Manages business legal entities (Companies) within a Tenant.
 *
 * Implements 1 Tenant -> N Companies scoping with strict anti-IDOR validation.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { Optional } from '@nestjs/common';
import { CompanyProfileService } from '../company-profile/company-profile.service.js';
import { EntitlementService } from '../billing/entitlement.service.js';
import type { CompanyProfilePayload } from '../company-profile/presentation/dto/CompanyProfilePayload.js';

export interface CreateCompanyDto {
  legalName: string;
  slug?: string;
  gstin?: string;
  pan?: string;
  udyamId?: string;
  constitution?: string;
}

export interface CompanyView {
  id: string;
  organizationId: string;
  legalName: string;
  slug: string | null;
  gstin: string | null;
  pan: string | null;
  udyamId: string | null;
  constitution: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CompaniesService {
  private readonly db: DrizzleDb;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    private readonly companyProfileService: CompanyProfileService,
    @Optional() @Inject(EntitlementService) private readonly entitlementService?: EntitlementService,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * List all companies belonging to the caller's tenant.
   */
  public async listCompanies(): Promise<CompanyView[]> {
    const orgId = this.requireOrg();

    const records = await this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .orderBy(desc(schema.companies.createdAt));

    return records.map((r) => this.mapCompany(r));
  }

  /**
   * Get a single company by ID, verifying tenant ownership (Anti-IDOR).
   */
  public async getCompanyById(companyId: string): Promise<CompanyView> {
    const orgId = this.requireOrg();

    const [record] = await this.db
      .select()
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.id, companyId),
          eq(schema.companies.organizationId, orgId),
        ),
      )
      .limit(1);

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

    const [created] = await this.db
      .insert(schema.companies)
      .values({
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
      })
      .returning();

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
      udyamId: r.udyamId,
      constitution: r.constitution,
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
