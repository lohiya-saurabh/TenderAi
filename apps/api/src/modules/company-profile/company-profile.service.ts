/**
 * CompanyProfileService — Manages company capability profiles and versioning.
 *
 * Implements immutable append-only versioning: new versions are appended
 * to `company_profile_versions` and the `company_profiles` pointer is updated
 * atomically. Every lookup verifies tenant ownership (Anti-IDOR).
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import {
  type CompanyProfilePayload,
  validateCompanyProfilePayload,
} from '@/modules/company-profile/presentation/dto/CompanyProfilePayload.js';
import { CompanyProfileRepository } from '@/modules/company-profile/company-profile.repository.js';

export interface CompanyProfileVersionView {
  id: string;
  companyId: string;
  organizationId: string;
  version: number;
  name: string;
  payload: CompanyProfilePayload;
  createdBy: string;
  createdAt: string;
}

export interface CompanyProfileView {
  companyId?: string;
  active: CompanyProfileVersionView | null;
  versions: CompanyProfileVersionView[];
}

export interface ExpiringCertificateItem {
  entryId: string;
  type: 'CERTIFICATION' | 'OEM_AUTHORIZATION';
  name: string;
  issuingAuthority?: string;
  validFrom?: string;
  validTo?: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  isUrgent: boolean;
  evidenceDocumentId?: string;
}

export interface ExpiringCertificatesResult {
  organizationId: string;
  companyId?: string;
  activeProfileVersionId: string | null;
  evaluatedAt: string;
  filterWithinDays: number;
  totalExpiringCount: number;
  totalExpiredCount: number;
  certificates: ExpiringCertificateItem[];
}

@Injectable()
export class CompanyProfileService {
  private readonly repository: CompanyProfileRepository;

  constructor(
    @Inject(CompanyProfileRepository)
    repositoryOrDb: CompanyProfileRepository | DrizzleDb | PGlite,
  ) {
    this.repository =
      repositoryOrDb instanceof CompanyProfileRepository
        ? repositoryOrDb
        : new CompanyProfileRepository(repositoryOrDb);
  }

  /**
   * Resolves the target company ID, ensuring it belongs to the authenticated tenant.
   * If companyId is omitted, resolves the primary company for the tenant.
   */
  public async resolveCompanyId(companyId?: string): Promise<string> {
    const orgId = this.requireOrg();

    if (companyId) {
      const comp = await this.repository.findCompany(companyId, orgId);

      if (!comp) {
        throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
      }
      return comp.id;
    }

    const defaultComp = await this.repository.findDefaultCompany(orgId);

    if (!defaultComp) {
      throw new BadRequestError(
        'No company entity found for this organization. Every organization must have at least one company.',
      );
    }

    return defaultComp.id;
  }

  /** Active version + full version history for the company / tenant. */
  public async getProfile(companyId?: string): Promise<CompanyProfileView> {
    const orgId = this.requireOrg();

    let targetCompId: string;
    if (companyId) {
      targetCompId = await this.resolveCompanyId(companyId);
    } else {
      const defaultComp = await this.repository.findDefaultCompany(orgId);

      if (!defaultComp) {
        return {
          companyId: undefined,
          active: null,
          versions: [],
        };
      }
      targetCompId = defaultComp.id;
    }

    const versions = await this.repository.getVersions(targetCompId, orgId);
    const pointer = await this.repository.getActivePointer(targetCompId, orgId);

    const views = versions.map((v) => this.mapVersion(v));
    const active = pointer
      ? (views.find((v) => v.id === pointer.activeVersionId) ?? views[0] ?? null)
      : (views[0] ?? null);

    return { companyId: targetCompId, active, versions: views };
  }

  /**
   * Identifies certifications and OEM authorizations expiring within the specified window.
   */
  public async getExpiringCertificates(
    withinDays = 90,
    companyId?: string,
  ): Promise<ExpiringCertificatesResult> {
    const orgId = this.requireOrg();
    const now = new Date();
    const profile = await this.getProfile(companyId);

    if (!profile.active || !profile.active.payload) {
      return {
        organizationId: orgId,
        companyId: profile.companyId,
        activeProfileVersionId: null,
        evaluatedAt: now.toISOString(),
        filterWithinDays: withinDays,
        totalExpiringCount: 0,
        totalExpiredCount: 0,
        certificates: [],
      };
    }

    const payload = profile.active.payload;
    const certs: ExpiringCertificateItem[] = [];

    if (Array.isArray(payload.certifications)) {
      for (const c of payload.certifications) {
        let daysRemaining: number | null = null;
        let isExpired = false;
        let isUrgent = false;

        if (c.valid_to) {
          const target = new Date(c.valid_to);
          if (!Number.isNaN(target.getTime())) {
            daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            isExpired = daysRemaining < 0;
            isUrgent = daysRemaining >= 0 && daysRemaining <= 30;
          }
        }

        if (daysRemaining !== null && daysRemaining <= withinDays) {
          certs.push({
            entryId: c.entry_id,
            type: 'CERTIFICATION',
            name: c.standard_name,
            issuingAuthority: c.issuing_body,
            validFrom: c.valid_from,
            validTo: c.valid_to ?? null,
            daysRemaining,
            isExpired,
            isUrgent,
            evidenceDocumentId: c.evidence_document_id,
          });
        }
      }
    }

    if (Array.isArray(payload.oem_authorizations)) {
      for (const oem of payload.oem_authorizations) {
        let daysRemaining: number | null = null;
        let isExpired = false;
        let isUrgent = false;

        if (oem.valid_to) {
          const target = new Date(oem.valid_to);
          if (!Number.isNaN(target.getTime())) {
            daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            isExpired = daysRemaining < 0;
            isUrgent = daysRemaining >= 0 && daysRemaining <= 30;
          }
        }

        if (daysRemaining !== null && daysRemaining <= withinDays) {
          certs.push({
            entryId: oem.entry_id,
            type: 'OEM_AUTHORIZATION',
            name: `${oem.oem_name} Authorization`,
            issuingAuthority: oem.oem_name,
            validFrom: oem.valid_from,
            validTo: oem.valid_to,
            daysRemaining,
            isExpired,
            isUrgent,
            evidenceDocumentId: oem.evidence_document_id,
          });
        }
      }
    }

    certs.sort((a, b) => (a.daysRemaining ?? 999999) - (b.daysRemaining ?? 999999));

    return {
      organizationId: orgId,
      companyId: profile.companyId,
      activeProfileVersionId: profile.active.id,
      evaluatedAt: now.toISOString(),
      filterWithinDays: withinDays,
      totalExpiringCount: certs.filter((c) => !c.isExpired).length,
      totalExpiredCount: certs.filter((c) => c.isExpired).length,
      certificates: certs,
    };
  }

  /** Fetch a specific immutable version by id (tenant-scoped). */
  public async getVersionById(
    versionId: string,
    companyId?: string,
  ): Promise<CompanyProfileVersionView> {
    const orgId = this.requireOrg();
    const targetCompId = companyId ? await this.resolveCompanyId(companyId) : undefined;

    const record = await this.repository.getVersionById(versionId, orgId, targetCompId);

    if (!record) {
      throw new NotFoundError(`Company profile version '${versionId}' not found.`);
    }
    return this.mapVersion(record);
  }

  /**
   * Pins a new immutable profile version and makes it active for a company.
   * Validation happens here so malformed snapshots never enter
   * the evaluation pipeline.
   */
  public async createProfileVersion(
    name: string,
    payload: unknown,
    companyId?: string,
  ): Promise<CompanyProfileVersionView> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';
    const targetCompId = await this.resolveCompanyId(companyId);

    const violations = validateCompanyProfilePayload(payload);
    if (violations.length > 0) {
      throw new BadRequestError(`Company profile validation failed: ${violations.join(' ')}`);
    }

    const nextVer = (await this.repository.getMaxVersion(orgId, targetCompId)) + 1;
    const trimmedName =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : `Profile v${nextVer}`;

    // Immutable append-only versioning: never update in place.
    const versionNumber = nextVer;
    const versionId = `cpv-${targetCompId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    await this.repository.insertVersion({
      id: versionId,
      companyId: targetCompId,
      organizationId: orgId,
      version: versionNumber,
      name: trimmedName,
      payload: payload as CompanyProfilePayload,
      createdBy: userId,
      createdAt: now,
    });

    // Re-point the active version for this company.
    const pointerId = `prof_${targetCompId}`;
    await this.repository.upsertActivePointer(pointerId, targetCompId, orgId, versionId, now);

    return {
      id: versionId,
      companyId: targetCompId,
      organizationId: orgId,
      version: versionNumber,
      name: trimmedName,
      payload: payload as CompanyProfilePayload,
      createdBy: userId,
      createdAt: now.toISOString(),
    };
  }

  private mapVersion(record: schema.CompanyProfileVersion): CompanyProfileVersionView {
    const payload =
      typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
    return {
      id: record.id,
      companyId: record.companyId,
      organizationId: record.organizationId,
      version: record.version,
      name: record.name,
      payload: payload as CompanyProfilePayload,
      createdBy: record.createdBy,
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : String(record.createdAt),
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required to access the company profile.');
    }
    return orgId;
  }
}
