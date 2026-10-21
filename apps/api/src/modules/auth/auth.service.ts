/**
 * AuthService — Handles user authentication against PostgreSQL with cryptographic JWTs.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '@/common/errors/errors.js';
import { TokenService } from '@/common/security/TokenService.js';
import { ROLE_PERMISSIONS, type UserRole, type Permission } from '@/common/security/permissions.js';
import { AuthRepository } from '@/modules/auth/auth.repository.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    organizationId: string;
    organizationName: string;
  };
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  udyamId?: string;
  locationState?: string;
}

export interface RegisterResult extends AuthResult {
  company?: {
    id: string;
    legalName: string;
  };
}

@Injectable()
export class AuthService {
  private readonly repository: AuthRepository;
  private readonly tokenService: TokenService;
  private readonly dummyBcryptHash: string;

  constructor(
    @Inject(AuthRepository) repoOrDb: AuthRepository | DrizzleDb | PGlite,
    @Optional() @Inject(TokenService) tokenService?: TokenService,
    @Optional() configService?: ConfigService,
  ) {
    this.repository =
      repoOrDb instanceof AuthRepository ? repoOrDb : new AuthRepository(repoOrDb);
    this.tokenService = tokenService || new TokenService();
    this.dummyBcryptHash = configService?.get<string>('BCRYPT_HASH') ?? '';
  }

  public async login(email?: string, password?: string): Promise<AuthResult> {
    const candidateEmail = String(email || '').trim();
    const candidatePassword = String(password || '');

    const matched = await this.repository.findUserByEmail(candidateEmail);

    if (!matched) {
      // Defend against user enumeration by equalizing comparison latency (~70ms)
      if (this.dummyBcryptHash) {
        await bcrypt.compare(candidatePassword, this.dummyBcryptHash);
      }
      throw new UnauthorizedError('Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(candidatePassword, matched.password);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const rawPermissions: Permission[] =
      typeof matched.permissions === 'string'
        ? JSON.parse(matched.permissions)
        : (matched.permissions ?? []);
    const normalizedRole = String(matched.role ?? 'VIEWER')
      .toUpperCase()
      .replace(/\s+/g, '_') as UserRole;

    const defaultRolePerms = ROLE_PERMISSIONS[normalizedRole]
      ? Array.from(ROLE_PERMISSIONS[normalizedRole])
      : [];
    const permissions: Permission[] = Array.from(new Set([...rawPermissions, ...defaultRolePerms]));

    const userProfile = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: normalizedRole,
      permissions,
      organizationId: matched.organizationId,
      organizationName: matched.organizationName,
    };

    const accessToken = this.tokenService.signAccessToken({
      sub: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      role: userProfile.role,
      permissions: userProfile.permissions,
      organizationId: userProfile.organizationId,
      organizationName: userProfile.organizationName,
    });
    const refreshToken = this.tokenService.signRefreshToken(userProfile.id);

    await this.persistRefreshToken(userProfile.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: userProfile,
    };
  }

  public async refresh(
    incomingRefreshToken?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!incomingRefreshToken) {
      throw new UnauthorizedError('Missing or empty refresh token.');
    }

    // Cryptographic signature and expiration check
    const { userId } = this.tokenService.verifyRefreshToken(incomingRefreshToken);

    const tokenHash = crypto.createHash('sha256').update(incomingRefreshToken).digest('hex');
    const storedToken = await this.repository.findRefreshTokenByHash(tokenHash);

    if (storedToken && storedToken.revokedAt) {
      throw new UnauthorizedError('Refresh token has been revoked.');
    }

    if (storedToken) {
      await this.repository.revokeRefreshToken(tokenHash);
    }

    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedError(
        'User account associated with this refresh token no longer exists.',
      );
    }

    const rawPermissions: Permission[] =
      typeof user.permissions === 'string'
        ? JSON.parse(user.permissions)
        : (user.permissions ?? []);
    const normalizedRole = String(user.role ?? 'BID_MANAGER')
      .toUpperCase()
      .replace(/\s+/g, '_') as UserRole;

    const defaultRolePerms = ROLE_PERMISSIONS[normalizedRole]
      ? Array.from(ROLE_PERMISSIONS[normalizedRole])
      : [];
    const permissions: Permission[] = Array.from(new Set([...rawPermissions, ...defaultRolePerms]));

    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizedRole,
      permissions,
      organizationId: user.organizationId,
      organizationName: user.organizationName,
    };

    const newAccessToken = this.tokenService.signAccessToken({
      sub: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      role: userProfile.role,
      permissions: userProfile.permissions,
      organizationId: userProfile.organizationId,
      organizationName: userProfile.organizationName,
    });
    const newRefreshToken = this.tokenService.signRefreshToken(userProfile.id);

    await this.persistRefreshToken(userProfile.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async logout(incomingRefreshToken?: string): Promise<void> {
    if (!incomingRefreshToken) return;
    const tokenHash = crypto.createHash('sha256').update(incomingRefreshToken).digest('hex');
    await this.repository.revokeRefreshToken(tokenHash);
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    await this.repository.createRefreshToken({
      id: `rt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
  }

  /**
   * Register a new user account, auto-provision their Tenant Workspace,
   * initial Free Plan subscription, and first Company entity.
   */
  public async register(dto: RegisterDto): Promise<RegisterResult> {
    const candidateEmail = String(dto.email || '')
      .trim()
      .toLowerCase();
    const candidatePassword = String(dto.password || '');
    const candidateName = String(dto.name || '').trim();

    if (!candidateEmail || !candidateEmail.includes('@')) {
      throw new BadRequestError('A valid email address is required.');
    }
    if (!candidateName) {
      throw new BadRequestError('Full name is required.');
    }
    if (candidatePassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long.');
    }

    // 1. Email Uniqueness Check
    const existing = await this.repository.findUserByEmail(candidateEmail);

    if (existing) {
      throw new ConflictError('An account with this email address already exists. Please sign in.');
    }

    // 2. Generate Unique Entity Identifiers
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 6);
    const userId = `usr_${timestamp}_${rand}`;
    const orgId = `org_${timestamp}_${rand}`;
    const companyId = `comp_${timestamp}_${rand}`;

    const orgName = dto.organizationName?.trim() || `${candidateName}'s Workspace`;
    const companyName = dto.companyName?.trim() || `${candidateName} Infrastructure Pvt Ltd`;

    // 3. Hash Password (bcrypt cost-10)
    const hashedPassword = await bcrypt.hash(candidatePassword, 10);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // 3b. Create Canonical Organization Entity
    const orgSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const adminPermissions: Permission[] = Array.from(ROLE_PERMISSIONS.ADMIN);
    const profileVersionId = `cpv_${timestamp}_${rand}`;

    const createdUser = await this.repository.registerTenant({
      org: {
        id: orgId,
        name: orgName,
        slug: `${orgSlug}-${rand}`,
        domain: candidateEmail.split('@')[1] ?? null,
        createdAt: now,
        updatedAt: now,
      },
      user: {
        id: userId,
        email: candidateEmail,
        password: hashedPassword,
        name: candidateName,
        role: 'ADMIN',
        permissions: adminPermissions,
        organizationId: orgId,
        organizationName: orgName,
      },
      tenantSettings: {
        id: `ts_${timestamp}_${rand}`,
        organizationId: orgId,
        defaultCompanyId: companyId,
        notificationPreferences: {
          notifyDeadlines: true,
          notifyEvidenceExpiry: true,
          notifyReviewRequests: true,
          notifyHighRiskFlags: true,
        },
      },
      company: {
        id: companyId,
        organizationId: orgId,
        legalName: companyName,
        slug: companyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        gstin: dto.gstin?.trim() || null,
        pan: dto.pan?.trim() || null,
        cin: dto.cin?.trim() || null,
        udyamId: dto.udyamId?.trim() || null,
        constitution: 'PUBLIC_LIMITED',
        createdAt: now,
        updatedAt: now,
      },
      profileVersion: {
        id: profileVersionId,
        companyId: companyId,
        organizationId: orgId,
        version: 1,
        name: 'V1.0 (Active Registered Baseline)',
        payload: {
          company_name: companyName,
          legal_entity_name: companyName,
          cin_number: dto.cin?.trim() || null,
          incorporation_date: null,
          msme_category: 'MICRO',
          is_blacklisted: false,
          registrations: dto.gstin?.trim() ? { gstin: dto.gstin.trim() } : {},
          turnover_records: [],
          past_experience: [],
          certifications: [],
        },
        createdBy: userId,
        createdAt: now,
      },
      profilePointer: {
        id: `prof_${companyId}`,
        companyId: companyId,
        organizationId: orgId,
        activeVersionId: profileVersionId,
        updatedAt: now,
      },
      subscription: {
        id: `sub_${timestamp}_${rand}`,
        organizationId: orgId,
        planTier: 'FREE',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    // 8. Sign JWT Access and Refresh Tokens
    const finalUserId = createdUser ? createdUser.id : userId;
    const finalEmail = createdUser ? createdUser.email : candidateEmail;
    const finalName = createdUser ? createdUser.name : candidateName;

    const userProfile = {
      id: finalUserId,
      email: finalEmail,
      name: finalName,
      role: 'ADMIN' as UserRole,
      permissions: adminPermissions,
      organizationId: orgId,
      organizationName: orgName,
    };

    const accessToken = this.tokenService.signAccessToken({
      sub: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      role: userProfile.role,
      permissions: userProfile.permissions,
      organizationId: userProfile.organizationId,
      organizationName: userProfile.organizationName,
    });
    const refreshToken = this.tokenService.signRefreshToken(userProfile.id);
    await this.persistRefreshToken(userProfile.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: userProfile,
      company: {
        id: companyId,
        legalName: companyName,
      },
    };
  }
}
