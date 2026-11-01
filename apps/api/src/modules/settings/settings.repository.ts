import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class SettingsRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findOrganizationName(orgId: string): Promise<string | null> {
    const [org] = await this.db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .limit(1);

    return org?.name ?? null;
  }

  public async findUserOrganizationName(userId: string): Promise<string | null> {
    const [userRec] = await this.db
      .select({ organizationName: schema.users.organizationName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return userRec?.organizationName ?? null;
  }

  public async findSettingsByOrganization(
    orgId: string,
  ): Promise<schema.TenantSetting | null> {
    const [record] = await this.db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.organizationId, orgId))
      .limit(1);

    return record ?? null;
  }

  public async createDefaultSettings(
    newSettings: schema.NewTenantSetting,
  ): Promise<schema.TenantSetting | null> {
    const [created] = await this.db
      .insert(schema.tenantSettings)
      .values(newSettings)
      .onConflictDoNothing()
      .returning();

    return created ?? null;
  }

  public async upsertSettings(
    values: schema.NewTenantSetting,
    updates: Partial<schema.NewTenantSetting>,
  ): Promise<void> {
    await this.db
      .insert(schema.tenantSettings)
      .values(values)
      .onConflictDoUpdate({
        target: schema.tenantSettings.organizationId,
        set: updates,
      });
  }

  public async upsertOrganization(
    orgId: string,
    name: string,
    slug: string,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .insert(schema.organizations)
      .values({
        id: orgId,
        name,
        slug,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.organizations.id,
        set: { name, updatedAt: now },
      });
  }

  public async updateUsersOrganizationName(
    orgId: string,
    name: string,
  ): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ organizationName: name })
      .where(eq(schema.users.organizationId, orgId));
  }
}
