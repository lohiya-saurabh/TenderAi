/**
 * TeamsService — Manages team members and invitations within a Tenant.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { BadRequestError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { ROLE_PERMISSIONS, type UserRole } from '../../common/security/permissions.js';

export interface InviteMemberDto {
  email: string;
  name: string;
  role: string;
}

export interface TeamMemberView {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

@Injectable()
export class TeamsService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * List all team members within the caller's tenant.
   */
  public async listMembers(): Promise<TeamMemberView[]> {
    const orgId = this.requireOrg();

    const records = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        phone: schema.users.phone,
        role: schema.users.role,
        permissions: schema.users.permissions,
        organizationId: schema.users.organizationId,
        organizationName: schema.users.organizationName,
      })
      .from(schema.users)
      .where(eq(schema.users.organizationId, orgId));

    return records.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone ?? null,
      role: r.role,
      permissions: r.permissions ?? [],
      organizationId: r.organizationId,
      organizationName: r.organizationName,
    }));
  }

  /**
   * Invite / provision a new team member into the caller's tenant.
   */
  public async inviteMember(dto: InviteMemberDto): Promise<TeamMemberView> {
    const orgId = this.requireOrg();
    const callerUserId = TenantContextHolder.get()?.userId;

    let orgName = 'Default Workspace';
    if (callerUserId) {
      const [userRec] = await this.db
        .select({ organizationName: schema.users.organizationName })
        .from(schema.users)
        .where(eq(schema.users.id, callerUserId))
        .limit(1);
      if (userRec?.organizationName) {
        orgName = userRec.organizationName;
      }
    }

    if (!dto.email || !dto.email.includes('@')) {
      throw new BadRequestError('Valid email address is required.');
    }
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestError('Name is required.');
    }

    const normalizedRole = (dto.role || 'VIEWER').toUpperCase().replace(/[\s-]/g, '_');
    let permissionsSet = ROLE_PERMISSIONS[normalizedRole as UserRole];
    if (!permissionsSet) {
      if (
        normalizedRole === 'LEGAL_COUNSEL' ||
        normalizedRole === 'COMPLIANCE_OFFICER' ||
        normalizedRole === 'FINANCIAL_CONTROLLER' ||
        normalizedRole === 'TECHNICAL_LEAD'
      ) {
        permissionsSet = ROLE_PERMISSIONS.REVIEWER;
      } else {
        permissionsSet = ROLE_PERMISSIONS.VIEWER;
      }
    }
    const permissions: string[] = normalizedRole === 'ADMIN' ? ['*'] : Array.from(permissionsSet);

    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempPassword = await bcrypt.hash('TenderPulse@2026', 10);

    const [created] = await this.db
      .insert(schema.users)
      .values({
        id: newUserId,
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        password: tempPassword,
        phone: null,
        role: normalizedRole,
        permissions,
        organizationId: orgId,
        organizationName: orgName,
      })
      .returning();

    if (!created) {
      throw new BadRequestError('Failed to provision new team member.');
    }

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      phone: created.phone ?? null,
      role: created.role,
      permissions: created.permissions ?? [],
      organizationId: created.organizationId,
      organizationName: created.organizationName,
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required to access team members.');
    }
    return orgId;
  }
}
