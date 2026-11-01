import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class TeamsRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listMembersByOrganization(orgId: string): Promise<schema.User[]> {
    return this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        phone: schema.users.phone,
        role: schema.users.role,
        permissions: schema.users.permissions,
        organizationId: schema.users.organizationId,
        organizationName: schema.users.organizationName,
        password: schema.users.password,
        inviteTokenHash: schema.users.inviteTokenHash,
        inviteExpiresAt: schema.users.inviteExpiresAt,
      })
      .from(schema.users)
      .where(eq(schema.users.organizationId, orgId));
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

  public async createUser(newUser: schema.NewUser): Promise<schema.User | null> {
    const [created] = await this.db.insert(schema.users).values(newUser).returning();

    return created ?? null;
  }

  public async findMember(userId: string, orgId: string): Promise<schema.User | null> {
    const [member] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), eq(schema.users.organizationId, orgId)))
      .limit(1);
    return member ?? null;
  }

  public async setInvite(
    userId: string,
    orgId: string,
    invite: { tokenHash: string; expiresAt: Date },
  ): Promise<schema.User | null> {
    const [updated] = await this.db
      .update(schema.users)
      .set({ inviteTokenHash: invite.tokenHash, inviteExpiresAt: invite.expiresAt })
      .where(and(eq(schema.users.id, userId), eq(schema.users.organizationId, orgId)))
      .returning();
    return updated ?? null;
  }
}
