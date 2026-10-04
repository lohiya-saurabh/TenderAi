/**
 * AuthService — Handles user authentication against PostgreSQL.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { UnauthorizedError } from '../../common/errors/errors.js';

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

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
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

    const permissions =
      typeof matched.permissions === 'string' ? JSON.parse(matched.permissions) : matched.permissions;

    const userProfile = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role,
      permissions,
      organizationId: matched.organizationId,
      organizationName: matched.organizationName,
    };

    const accessToken = `tp_demo_access_${Buffer.from(JSON.stringify(userProfile)).toString('base64url')}`;
    const refreshToken = `tp_demo_refresh_${userProfile.id}_${Date.now()}`;

    return {
      accessToken,
      refreshToken,
      user: userProfile,
    };
  }

  public async refresh(): Promise<{ accessToken: string; refreshToken: string }> {
    const [defaultUser] = await this.db.select().from(schema.users).limit(1);
    if (!defaultUser) {
      throw new UnauthorizedError('No active user available for refresh.');
    }

    const permissions =
      typeof defaultUser.permissions === 'string'
        ? JSON.parse(defaultUser.permissions)
        : defaultUser.permissions;

    const userProfile = {
      id: defaultUser.id,
      email: defaultUser.email,
      name: defaultUser.name,
      role: defaultUser.role,
      permissions,
      organizationId: defaultUser.organizationId,
      organizationName: defaultUser.organizationName,
    };

    const newJwt = `tp_demo_access_${Buffer.from(JSON.stringify(userProfile)).toString('base64url')}`;
    const newRefresh = `tp_demo_refresh_${userProfile.id}_${Date.now()}`;

    return {
      accessToken: newJwt,
      refreshToken: newRefresh,
    };
  }
}
