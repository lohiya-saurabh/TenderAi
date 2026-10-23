import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, max } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class CompanyProfileRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findCompany(companyId: string, orgId: string): Promise<schema.Company | null> {
    const [comp] = await this.db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .limit(1);

    return comp ?? null;
  }

  public async findDefaultCompany(orgId: string): Promise<schema.Company | null> {
    const [defaultComp] = await this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .limit(1);

    return defaultComp ?? null;
  }

  public async getVersions(
    companyId: string,
    orgId: string,
  ): Promise<schema.CompanyProfileVersion[]> {
    return this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(
        and(
          eq(schema.companyProfileVersions.organizationId, orgId),
          eq(schema.companyProfileVersions.companyId, companyId),
        ),
      )
      .orderBy(desc(schema.companyProfileVersions.version));
  }

  public async getActivePointer(
    companyId: string,
    orgId: string,
  ): Promise<schema.CompanyProfile | null> {
    const [pointer] = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(
        and(
          eq(schema.companyProfiles.organizationId, orgId),
          eq(schema.companyProfiles.companyId, companyId),
        ),
      )
      .limit(1);

    return pointer ?? null;
  }

  public async getVersionById(
    versionId: string,
    orgId: string,
    companyId?: string,
  ): Promise<schema.CompanyProfileVersion | null> {
    const conditions = [
      eq(schema.companyProfileVersions.id, versionId),
      eq(schema.companyProfileVersions.organizationId, orgId),
    ];
    if (companyId) {
      conditions.push(eq(schema.companyProfileVersions.companyId, companyId));
    }

    const [record] = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(and(...conditions))
      .limit(1);

    return record ?? null;
  }

  public async insertVersion(data: schema.NewCompanyProfileVersion): Promise<void> {
    await this.db.insert(schema.companyProfileVersions).values(data);
  }

  public async upsertActivePointer(
    pointerId: string,
    companyId: string,
    orgId: string,
    versionId: string,
    now: Date,
  ): Promise<void> {
    const existing = await this.getActivePointer(companyId, orgId);

    if (existing) {
      await this.db
        .update(schema.companyProfiles)
        .set({ activeVersionId: versionId, updatedAt: now })
        .where(
          and(
            eq(schema.companyProfiles.companyId, companyId),
            eq(schema.companyProfiles.organizationId, orgId),
          ),
        );
    } else {
      await this.db.insert(schema.companyProfiles).values({
        id: pointerId,
        companyId,
        organizationId: orgId,
        activeVersionId: versionId,
        updatedAt: now,
      });
    }
  }

  public async getMaxVersion(orgId: string, companyId?: string): Promise<number> {
    const conditions = [eq(schema.companyProfileVersions.organizationId, orgId)];
    if (companyId) {
      conditions.push(eq(schema.companyProfileVersions.companyId, companyId));
    }
    const [row] = await this.db
      .select({ maxVersion: max(schema.companyProfileVersions.version) })
      .from(schema.companyProfileVersions)
      .where(and(...conditions));

    return row?.maxVersion ?? 0;
  }
}
