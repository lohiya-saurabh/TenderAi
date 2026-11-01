import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class CompaniesRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listCompaniesByOrganization(orgId: string): Promise<schema.Company[]> {
    return this.db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .orderBy(desc(schema.companies.createdAt));
  }

  public async findCompanyById(companyId: string, orgId: string): Promise<schema.Company | null> {
    const [record] = await this.db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .limit(1);

    return record ?? null;
  }

  public async createCompany(newCompany: schema.NewCompany): Promise<schema.Company | null> {
    const [created] = await this.db
      .insert(schema.companies)
      .values(newCompany)
      .returning();

    return created ?? null;
  }

  public async updateCompany(
    companyId: string,
    orgId: string,
    updates: Partial<schema.NewCompany>,
  ): Promise<schema.Company | null> {
    const [updated] = await this.db
      .update(schema.companies)
      .set(updates)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .returning();

    return updated ?? null;
  }
}
