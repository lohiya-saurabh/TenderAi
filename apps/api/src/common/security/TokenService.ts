/**
 * TokenService — Cryptographic JWT Token Signing & Constant-Time Verification
 *
 * Implements RFC 7519 compliant HMAC-SHA256 JWTs using native Node.js node:crypto.
 * Zero third-party dependencies, constant-time signature verification, and immune
 * to timing attacks.
 */

import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { UnauthorizedError } from '../errors/errors.js';
import type { UserRole, Permission } from './permissions.js';

export interface UserTokenPayload {
  sub: string; // userId
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  organizationId: string;
  organizationName: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  type: 'refresh';
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor() {
    this.secret =
      process.env['JWT_SECRET'] || 'tenderpulse-super-secret-jwt-key-2026-production-grade';
    if (process.env['NODE_ENV'] === 'production' && !process.env['JWT_SECRET']) {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
    }
    this.accessTokenTtlSeconds = Number(process.env['JWT_ACCESS_TTL_SECONDS']) || 3600; // 1 hour
    this.refreshTokenTtlSeconds = Number(process.env['JWT_REFRESH_TTL_SECONDS']) || 7 * 24 * 3600; // 7 days
  }

  /**
   * Signs an access token with HMAC-SHA256.
   */
  public signAccessToken(
    payload: Omit<UserTokenPayload, 'iat' | 'exp'>,
    ttlSeconds = this.accessTokenTtlSeconds,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: UserTokenPayload = {
      ...payload,
      iat: now,
      exp: now + ttlSeconds,
    };

    return this.createJwt(fullPayload);
  }

  /**
   * Verifies an access token in constant time and returns decoded claims.
   */
  public verifyAccessToken(token: string): UserTokenPayload {
    const payload = this.verifyJwt<UserTokenPayload>(token);

    if (!payload.sub || !payload.organizationId || !payload.role) {
      throw new UnauthorizedError('Malformed token claims: Missing required identity attributes.');
    }

    return payload;
  }

  /**
   * Signs a refresh token cryptographically bound to the userId.
   */
  public signRefreshToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
      iat: now,
      exp: now + this.refreshTokenTtlSeconds,
    };

    return this.createJwt(payload);
  }

  /**
   * Verifies a refresh token and extracts the userId.
   */
  public verifyRefreshToken(refreshToken: string): { userId: string } {
    const payload = this.verifyJwt<RefreshTokenPayload>(refreshToken);

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    return { userId: payload.sub };
  }

  // -------------------------------------------------------------
  // Internal RFC 7519 HMAC-SHA256 Implementation
  // -------------------------------------------------------------

  private createJwt(payload: object): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signatureInput)
      .digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  private verifyJwt<T extends { exp?: number }>(token: string): T {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Missing or invalid token.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedError('Malformed JWT: Expected 3 parts.');
    }

    const [encodedHeader, encodedPayload, incomingSignature] = parts;
    if (!encodedHeader || !encodedPayload || !incomingSignature) {
      throw new UnauthorizedError('Malformed JWT structure.');
    }

    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(signatureInput)
      .digest('base64url');

    const incomingBuf = Buffer.from(incomingSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    // Constant-time signature verification prevents timing attack forging
    if (
      incomingBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(incomingBuf, expectedBuf)
    ) {
      throw new UnauthorizedError('Invalid token signature.');
    }

    let payload: T;
    try {
      const decodedJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      payload = JSON.parse(decodedJson);
    } catch {
      throw new UnauthorizedError('Malformed token JSON payload.');
    }

    // Expiry verification
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        throw new UnauthorizedError('Token has expired.');
      }
    }

    return payload;
  }
}
