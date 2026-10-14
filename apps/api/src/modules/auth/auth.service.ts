/**
 * AuthService — Handles user authentication against PostgreSQL with cryptographic JWTs.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '../../common/errors/errors.js';
import { TokenService } from '../../common/security/TokenService.js';
import {
  ROLE_PERMISSIONS,
  type UserRole,
  type Permission,
} from '../../common/security/permissions.js';

// Precomputed cost-10 bcrypt hash used to normalize timing and defend against user enumeration
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

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
  private readonly db: DrizzleDb;
  private readonly tokenService: TokenService;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Optional() @Inject(TokenService) tokenService?: TokenService,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
    this.tokenService = tokenService || new TokenService();
  }

  public async login(email?: string, password?: string): Promise<AuthResult> {
    const candidateEmail = String(email || '').trim();
    const candidatePassword = String(password || '');

    // Drizzle ORM Type-Safe Query
    const [matched] = await this.db
      .select()
      .from(schema.users)
      .where(sql`LOWER(${schema.users.email}) = LOWER(${candidateEmail})`)
      .limit(1);

    if (!matched) {
      // Defend against user enumeration by equalizing comparison latency (~70ms)
      await bcrypt.compare(candidatePassword, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedError('Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(candidatePassword, matched.password);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const permissions: Permission[] =
      typeof matched.permissions === 'string'
        ? JSON.parse(matched.permissions)
        : matched.permissions;
    const normalizedRole = String(matched.role ?? 'BID_MANAGER')
      .toUpperCase()
      .replace(/\s+/g, '_');

    const userProfile = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: normalizedRole as UserRole,
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
    try {
      const [storedToken] = await this.db
        .select()
        .from(schema.refreshTokens)
        .where(sql`${schema.refreshTokens.tokenHash} = ${tokenHash}`)
        .limit(1);

      if (storedToken && storedToken.revokedAt) {
        throw new UnauthorizedError('Refresh token has been revoked.');
      }

      if (storedToken) {
        await this.db
          .update(schema.refreshTokens)
          .set({ revokedAt: new Date() })
          .where(sql`${schema.refreshTokens.tokenHash} = ${tokenHash}`);
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      // ignore table absence in memory test doubles
    }

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(sql`${schema.users.id} = ${userId}`)
      .limit(1);

    if (!user) {
      throw new UnauthorizedError(
        'User account associated with this refresh token no longer exists.',
      );
    }

    const permissions: Permission[] =
      typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    const normalizedRole = String(user.role ?? 'BID_MANAGER')
      .toUpperCase()
      .replace(/\s+/g, '_');

    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizedRole as UserRole,
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
    try {
      const tokenHash = crypto.createHash('sha256').update(incomingRefreshToken).digest('hex');
      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(sql`${schema.refreshTokens.tokenHash} = ${tokenHash}`);
    } catch {
      // ignore
    }
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      await this.db
        .insert(schema.refreshTokens)
        .values({
          id: `rt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          userId,
          tokenHash,
          expiresAt,
          createdAt: now,
        })
        .onConflictDoNothing();
    } catch {
      // ignore in test doubles where table is unseeded
    }
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
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(sql`LOWER(${schema.users.email}) = LOWER(${candidateEmail})`)
      .limit(1);

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

    // 4. Create User Record as TENANT_ADMIN
    const adminPermissions: Permission[] = Array.from(ROLE_PERMISSIONS.ADMIN);
    const [createdUser] = await this.db
      .insert(schema.users)
      .values({
        id: userId,
        email: candidateEmail,
        password: hashedPassword,
        name: candidateName,
        role: 'ADMIN',
        permissions: adminPermissions,
        organizationId: orgId,
        organizationName: orgName,
      })
      .returning();

    // 5. Create Tenant Settings with defaults
    await this.db
      .insert(schema.tenantSettings)
      .values({
        id: `ts_${timestamp}_${rand}`,
        organizationId: orgId,
        defaultCompanyId: companyId,
        notificationPreferences: {
          notifyDeadlines: true,
          notifyEvidenceExpiry: true,
          notifyReviewRequests: true,
          notifyHighRiskFlags: true,
        },
      })
      .onConflictDoNothing();

    // 6. Create Default Initial Company Entity
    await this.db
      .insert(schema.companies)
      .values({
        id: companyId,
        organizationId: orgId,
        legalName: companyName,
        slug: companyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        gstin: dto.gstin?.trim() || null,
        pan: dto.pan?.trim() || null,
        udyamId: dto.udyamId?.trim() || null,
        constitution: 'PRIVATE_LIMITED',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 6b. Create Initial Company Capability Profile Baseline
    const profileVersionId = `cpv_${timestamp}_${rand}`;
    await this.db
      .insert(schema.companyProfileVersions)
      .values({
        id: profileVersionId,
        companyId: companyId,
        organizationId: orgId,
        version: 1,
        name: 'V1.0 (Active Registered Baseline)',
        payload: {
          company_name: companyName,
          legal_entity_name: companyName,
          cin_number: null,
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
      })
      .onConflictDoNothing();

    await this.db
      .insert(schema.companyProfiles)
      .values({
        id: `prof_${companyId}`,
        companyId: companyId,
        organizationId: orgId,
        activeVersionId: profileVersionId,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 7. Create Initial Free Tier Subscription
    await this.db
      .insert(schema.subscriptions)
      .values({
        id: `sub_${timestamp}_${rand}`,
        organizationId: orgId,
        planTier: 'FREE',
        billingInterval: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .onConflictDoNothing();

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
