/**
 * CompanyProfileService — manages the tenant's Company
 * Capability Profile as immutable, versioned snapshots.
 *
 * The active version is the factual basis for bid/no-bid
 * evaluation, so every mutation creates a new immutable
 * version and re-points the active pointer (never
 * in-place edits). All queries are tenant-scoped.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, max } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import type {
  CompanyProfilePayload,
} from './presentation/dto/CompanyProfilePayload.js';
import { validateCompanyProfilePayload } from './presentation/dto/CompanyProfilePayload.js';

export interface CompanyProfileVersionView {
  id: string;
  companyId?: string;
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
  issuingAuthority: string;
  validFrom: string;
  validTo: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  isUrgent: boolean;
  evidenceDocumentId: string;
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
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Resolves the target company ID, ensuring it belongs to the authenticated tenant.
   * If companyId is omitted, resolves the primary company for the tenant.
   */
  public async resolveCompanyId(companyId?: string): Promise<string> {
    const orgId = this.requireOrg();

    if (companyId) {
      const [comp] = await this.db
        .select()
        .from(schema.companies)
        .where(
          and(
            eq(schema.companies.id, companyId),
            eq(schema.companies.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!comp) {
        throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
      }
      return comp.id;
    }

    const [defaultComp] = await this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .limit(1);

    if (!defaultComp) {
      throw new BadRequestError('No company entity found for this organization. Every organization must have at least one company.');
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
      const [defaultComp] = await this.db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.organizationId, orgId))
        .limit(1);

      if (!defaultComp) {
        return {
          companyId: undefined,
          active: null,
          versions: [],
        };
      }
      targetCompId = defaultComp.id;
    }

    const versions = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(
        and(
          eq(schema.companyProfileVersions.organizationId, orgId),
          eq(schema.companyProfileVersions.companyId, targetCompId),
        ),
      )
      .orderBy(desc(schema.companyProfileVersions.version));

    // Also check for pointers matching companyId or orgId
    const pointers = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(
        and(
          eq(schema.companyProfiles.organizationId, orgId),
          eq(schema.companyProfiles.companyId, targetCompId),
        ),
      )
      .limit(1);

    const pointer = pointers[0];
    const views = versions.map((v) => this.mapVersion(v));
    const active = pointer
      ? views.find((v) => v.id === pointer.activeVersionId) ?? views[0] ?? null
      : views[0] ?? null;

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

    const conditions = [
      eq(schema.companyProfileVersions.id, versionId),
      eq(schema.companyProfileVersions.organizationId, orgId),
    ];
    if (targetCompId) {
      conditions.push(eq(schema.companyProfileVersions.companyId, targetCompId));
    }

    const [record] = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(and(...conditions))
      .limit(1);

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
      throw new BadRequestError(
        `Company profile validation failed: ${violations.join(' ')}`,
      );
    }

    const trimmedName = typeof name === 'string' && name.trim()
      ? name.trim()
      : `Profile v${await this.nextVersion(orgId, targetCompId)}`;

    // Immutable append-only versioning: never update in place.
    const versionNumber = await this.nextVersion(orgId, targetCompId);
    const versionId = `cpv-${targetCompId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    await this.db.insert(schema.companyProfileVersions).values({
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
    const [existingPointer] = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(
        and(
          eq(schema.companyProfiles.companyId, targetCompId),
          eq(schema.companyProfiles.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existingPointer) {
      await this.db
        .update(schema.companyProfiles)
        .set({ activeVersionId: versionId, updatedAt: now })
        .where(
          and(
            eq(schema.companyProfiles.companyId, targetCompId),
            eq(schema.companyProfiles.organizationId, orgId),
          ),
        );
    } else {
      await this.db.insert(schema.companyProfiles).values({
        id: pointerId,
        companyId: targetCompId,
        organizationId: orgId,
        activeVersionId: versionId,
        updatedAt: now,
      });
    }

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

  private async nextVersion(orgId: string, companyId?: string): Promise<number> {
    const conditions = [eq(schema.companyProfileVersions.organizationId, orgId)];
    if (companyId) {
      conditions.push(eq(schema.companyProfileVersions.companyId, companyId));
    }
    const [row] = await this.db
      .select({ maxVersion: max(schema.companyProfileVersions.version) })
      .from(schema.companyProfileVersions)
      .where(and(...conditions));
    return (row?.maxVersion ?? 0) + 1;
  }

  private mapVersion(
    record: schema.CompanyProfileVersion,
  ): CompanyProfileVersionView {
    const payload =
      typeof record.payload === 'string'
        ? JSON.parse(record.payload)
        : record.payload;
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
