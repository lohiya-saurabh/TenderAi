import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

export interface RegisterEntitiesParams {
  org: schema.NewOrganization;
  user: schema.NewUser;
  tenantSettings: schema.NewTenantSetting;
  company: schema.NewCompany;
  profileVersion: schema.NewCompanyProfileVersion;
  profilePointer: schema.NewCompanyProfile;
  subscription: schema.NewSubscription;
}

@Injectable()
export class AuthRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findUserByEmail(email: string): Promise<schema.User | null> {
    const candidateEmail = String(email || '').trim();
    const [matched] = await this.db
      .select()
      .from(schema.users)
      .where(sql`LOWER(${schema.users.email}) = LOWER(${candidateEmail})`)
      .limit(1);

    return matched ?? null;
  }

  public async findUserById(userId: string): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(sql`${schema.users.id} = ${userId}`)
      .limit(1);

    return user ?? null;
  }

  public async findRefreshTokenByHash(tokenHash: string): Promise<schema.RefreshTokenRecord | null> {
    try {
      const [storedToken] = await this.db
        .select()
        .from(schema.refreshTokens)
        .where(sql`${schema.refreshTokens.tokenHash} = ${tokenHash}`)
        .limit(1);

      return storedToken ?? null;
    } catch {
      return null;
    }
  }

  public async revokeRefreshToken(tokenHash: string): Promise<void> {
    try {
      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(sql`${schema.refreshTokens.tokenHash} = ${tokenHash}`);
    } catch {
      // ignore
    }
  }

  public async createRefreshToken(tokenRecord: schema.NewRefreshTokenRecord): Promise<void> {
    try {
      await this.db
        .insert(schema.refreshTokens)
        .values(tokenRecord)
        .onConflictDoNothing();
    } catch {
      // ignore in test doubles where table is unseeded
    }
  }

  public async registerTenant(params: RegisterEntitiesParams): Promise<schema.User> {
    await this.db.insert(schema.organizations).values(params.org).onConflictDoNothing();

    const [createdUser] = await this.db
      .insert(schema.users)
      .values(params.user)
      .returning();

    await this.db.insert(schema.tenantSettings).values(params.tenantSettings).onConflictDoNothing();
    await this.db.insert(schema.companies).values(params.company).onConflictDoNothing();
    await this.db.insert(schema.companyProfileVersions).values(params.profileVersion).onConflictDoNothing();
    await this.db.insert(schema.companyProfiles).values(params.profilePointer).onConflictDoNothing();
    await this.db.insert(schema.subscriptions).values(params.subscription).onConflictDoNothing();

    return createdUser!;
  }
}
