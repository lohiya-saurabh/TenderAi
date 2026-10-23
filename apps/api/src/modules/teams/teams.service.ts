/**
 * TeamsService — Manages team members and invitations within a Tenant.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { BadRequestError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { ROLE_PERMISSIONS, type UserRole } from '@/common/security/permissions.js';
import { EntitlementService } from '@/modules/billing/entitlement.service.js';
import { TeamsRepository } from '@/modules/teams/teams.repository.js';

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
  private readonly repository: TeamsRepository;

  constructor(
    @Inject(TeamsRepository)
    repositoryOrDb: TeamsRepository | DrizzleDb | PGlite,
    @Optional()
    @Inject(EntitlementService)
    private readonly entitlementService?: EntitlementService,
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
    }));
  }

  /**
   * Invite / provision a new team member into the caller's tenant.
   */
  public async inviteMember(dto: InviteMemberDto): Promise<TeamMemberView> {
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
    const tempPassword = await bcrypt.hash('TenderPulse@2026', 10);

    const created = await this.repository.createUser({
      id: newUserId,
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      password: tempPassword,
      phone: null,
      role: normalizedRole,
      permissions,
      organizationId: orgId,
      organizationName: orgName,
    });

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
      throw new BadRequestError('Tenant organization context is required.');
    }
    return orgId;
  }
}
