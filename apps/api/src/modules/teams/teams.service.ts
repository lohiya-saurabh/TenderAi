/**
 * TeamsService — Manages team members and invitations within a Tenant.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { BadRequestError, NotFoundError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { ROLE_PERMISSIONS, type UserRole } from '@/common/security/permissions.js';
import { EntitlementService } from '@/modules/billing/entitlement.service.js';
import { TeamsRepository } from '@/modules/teams/teams.repository.js';
import type * as schema from '@/common/database/schema.js';

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
  /** True until the member opens their invite link and sets a password. */
  invitePending: boolean;
}

export interface InviteLinkView extends TeamMemberView {
  /** One-time link shown to the inviting admin once; only its hash is stored. */
  inviteUrl: string;
  inviteExpiresAt: string;
}

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

/** sha256 of an invite token: the only form the database ever holds. */
export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TeamsService {
  private readonly repository: TeamsRepository;

  constructor(
    @Inject(TeamsRepository)
    repositoryOrDb: TeamsRepository | DrizzleDb | PGlite,
    @Optional()
    @Inject(EntitlementService)
    private readonly entitlementService?: EntitlementService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.repository =
      repositoryOrDb instanceof TeamsRepository
        ? repositoryOrDb
        : new TeamsRepository(repositoryOrDb);
  }

  /**
   * List all team members within the caller's tenant.
   */
  public async listMembers(): Promise<TeamMemberView[]> {
    const orgId = this.requireOrg();

    const records = await this.repository.listMembersByOrganization(orgId);

    return records.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone ?? null,
      role: r.role,
      permissions: r.permissions ?? [],
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      invitePending: Boolean(r.inviteTokenHash),
    }));
  }

  /**
   * Invite / provision a new team member into the caller's tenant.
   */
  public async inviteMember(dto: InviteMemberDto): Promise<InviteLinkView> {
    const orgId = this.requireOrg();
    const callerUserId = TenantContextHolder.get()?.userId;

    let orgName = 'Default Workspace';
    const foundOrgName = await this.repository.findOrganizationName(orgId);

    if (foundOrgName) {
      orgName = foundOrgName;
    } else if (callerUserId) {
      const userOrgName = await this.repository.findUserOrganizationName(callerUserId);
      if (userOrgName) {
        orgName = userOrgName;
      }
    }

    if (!dto.email || !dto.email.includes('@')) {
      throw new BadRequestError('Valid email address is required.');
    }
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestError('Name is required.');
    }

    // Enforce Tenant Plan Entitlements
    if (this.entitlementService) {
      await this.entitlementService.checkUserLimit(orgId);
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
    // Nobody knows this password: the member sets their own through the invite link.
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const invite = this.newInvite();

    const created = await this.repository.createUser({
      id: newUserId,
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      password: unusablePassword,
      phone: null,
      role: normalizedRole,
      permissions,
      organizationId: orgId,
      organizationName: orgName,
      inviteTokenHash: invite.tokenHash,
      inviteExpiresAt: invite.expiresAt,
    });

    if (!created) {
      throw new BadRequestError('Failed to provision new team member.');
    }

    return this.toInviteView(created, invite);
  }

  /**
   * Issue a fresh invite link for a member who has not accepted yet (the old link stops
   * working). Also the way back in for accounts made with the retired shared password.
   */
  public async reissueInvite(memberId: string): Promise<InviteLinkView> {
    const orgId = this.requireOrg();
    const member = await this.repository.findMember(memberId, orgId);
    if (!member) {
      throw new NotFoundError(`Team member '${memberId}' not found.`);
    }
    const invite = this.newInvite();
    const updated = await this.repository.setInvite(memberId, orgId, invite);
    if (!updated) {
      throw new NotFoundError(`Team member '${memberId}' not found.`);
    }
    return this.toInviteView(updated, invite);
  }

  private newInvite(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    };
  }

  private toInviteView(
    user: schema.User,
    invite: { token: string; expiresAt: Date },
  ): InviteLinkView {
    const appBaseUrl = (
      this.configService?.get<string>('APP_BASE_URL') || 'http://localhost:5173'
    ).replace(/\/+$/, '');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      permissions: user.permissions ?? [],
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      invitePending: true,
      inviteUrl: `${appBaseUrl}/accept-invite?token=${invite.token}`,
      inviteExpiresAt: invite.expiresAt.toISOString(),
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant organization context is required.');
    }
    return orgId;
  }
}
