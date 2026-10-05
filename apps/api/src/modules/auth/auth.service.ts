/**
 * AuthService — Handles user authentication against PostgreSQL with cryptographic JWTs.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { UnauthorizedError } from '../../common/errors/errors.js';
import { TokenService } from '../../common/security/TokenService.js';
import type { UserRole, Permission } from '../../common/security/permissions.js';

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
      throw new UnauthorizedError(
        'Invalid email or password. Use demo credentials (e.g. bidmanager@acme.com / Password123!)',
      );
    }

    const passwordValid = await bcrypt.compare(candidatePassword, matched.password);
    if (!passwordValid) {
      throw new UnauthorizedError(
        'Invalid email or password. Use demo credentials (e.g. bidmanager@acme.com / Password123!)',
      );
    }

    const permissions: Permission[] =
      typeof matched.permissions === 'string' ? JSON.parse(matched.permissions) : matched.permissions;

    const userProfile = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role as UserRole,
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

    return {
      accessToken,
      refreshToken,
      user: userProfile,
    };
  }

  public async refresh(incomingRefreshToken?: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!incomingRefreshToken) {
      throw new UnauthorizedError('Missing or empty refresh token.');
    }

    // Cryptographic signature and expiration check
    const { userId } = this.tokenService.verifyRefreshToken(incomingRefreshToken);

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(sql`${schema.users.id} = ${userId}`)
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('User account associated with this refresh token no longer exists.');
    }

    const permissions: Permission[] =
      typeof user.permissions === 'string'
        ? JSON.parse(user.permissions)
        : user.permissions;

    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
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

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
