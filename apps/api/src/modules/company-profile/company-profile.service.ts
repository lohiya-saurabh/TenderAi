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
  organizationId: string;
  version: number;
  name: string;
  payload: CompanyProfilePayload;
  createdBy: string;
  createdAt: string;
}

export interface CompanyProfileView {
  active: CompanyProfileVersionView | null;
  versions: CompanyProfileVersionView[];
}

@Injectable()
export class CompanyProfileService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /** Active version + full version history for the tenant. */
  public async getProfile(): Promise<CompanyProfileView> {
    const orgId = this.requireOrg();

    const versions = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(eq(schema.companyProfileVersions.organizationId, orgId))
      .orderBy(desc(schema.companyProfileVersions.version));

    const [pointer] = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(eq(schema.companyProfiles.organizationId, orgId))
      .limit(1);

    const views = versions.map((v) => this.mapVersion(v));
    const active = pointer
      ? views.find((v) => v.id === pointer.activeVersionId) ?? null
      : null;

    return { active, versions: views };
  }

  /** Fetch a specific immutable version by id (tenant-scoped). */
  public async getVersionById(versionId: string): Promise<CompanyProfileVersionView> {
    const orgId = this.requireOrg();
    const [record] = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(
        and(
          eq(schema.companyProfileVersions.id, versionId),
          eq(schema.companyProfileVersions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!record) {
      throw new NotFoundError(`Company profile version '${versionId}' not found.`);
    }
    return this.mapVersion(record);
  }

  /**
   * Pins a new immutable profile version and makes it active.
   * Validation happens here so malformed snapshots never enter
   * the evaluation pipeline.
   */
  public async createProfileVersion(
    name: string,
    payload: unknown,
  ): Promise<CompanyProfileVersionView> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';

    const violations = validateCompanyProfilePayload(payload);
    if (violations.length > 0) {
      throw new BadRequestError(
        `Company profile validation failed: ${violations.join(' ')}`,
      );
    }

    const trimmedName = typeof name === 'string' && name.trim()
      ? name.trim()
      : `Profile v${await this.nextVersion(orgId)}`;

    // Immutable append-only versioning: never update in place.
    const versionNumber = await this.nextVersion(orgId);
    const versionId = `cpv-${orgId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    await this.db.insert(schema.companyProfileVersions).values({
      id: versionId,
      organizationId: orgId,
      version: versionNumber,
      name: trimmedName,
      payload: payload as CompanyProfilePayload,
      createdBy: userId,
      createdAt: now,
    });

    // Re-point the active version (upsert on organization PK).
    await this.db
      .insert(schema.companyProfiles)
      .values({
        organizationId: orgId,
        activeVersionId: versionId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.companyProfiles.organizationId,
        set: { activeVersionId: versionId, updatedAt: now },
      });

    return {
      id: versionId,
      organizationId: orgId,
      version: versionNumber,
      name: trimmedName,
      payload: payload as CompanyProfilePayload,
      createdBy: userId,
      createdAt: now.toISOString(),
    };
  }

  private async nextVersion(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ maxVersion: max(schema.companyProfileVersions.version) })
      .from(schema.companyProfileVersions)
      .where(eq(schema.companyProfileVersions.organizationId, orgId));
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
