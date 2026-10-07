import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import { TokenService } from '../../common/security/TokenService.js';
import { JwtAuthGuard } from '../../common/security/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/security/guards/roles.guard.js';
import { TenantContextInterceptor } from '../../common/security/interceptors/tenant-context.interceptor.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { Permissions, type UserRole } from '../../common/security/permissions.js';
import { UnauthorizedError, ForbiddenError } from '../../common/errors/errors.js';
import { AuthService } from '../auth/auth.service.js';

describe('Security & RBAC Hardening Suite', () => {
  let tokenService: TokenService;
  let reflector: Reflector;
  let authGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let tenantInterceptor: TenantContextInterceptor;
  let db: PGlite;
  let authService: AuthService;

  beforeEach(async () => {
    tokenService = new TokenService();
    reflector = new Reflector();
    authGuard = new JwtAuthGuard(reflector, tokenService);
    rolesGuard = new RolesGuard(reflector);
    tenantInterceptor = new TenantContextInterceptor();

    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    authService = new AuthService(db, tokenService);
  });

  const createMockContext = ({
    headers = {},
    query = {},
    user = undefined,
  }: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    user?: unknown;
  } = {}) => {
    const req: Record<string, unknown> = {
      headers: { ...headers },
      query: { ...query },
      user,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => () => {},
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { context, req };
  };

  describe('1. TokenService — Native HMAC-SHA256 & RFC 7519 Compliance', () => {
    it('should sign and verify valid access tokens', () => {
      const claims = {
        sub: 'usr_bid_mgr_01',
        email: 'bidmanager@acme.com',
        name: 'Vikramaditya Sharma',
        role: 'BID_MANAGER' as UserRole,
        permissions: [Permissions.BIDS_READ, Permissions.BIDS_CREATE],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme Infrastructure Pvt Ltd',
      };

      const token = tokenService.signAccessToken(claims);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const verified = tokenService.verifyAccessToken(token);
      expect(verified.sub).toBe('usr_bid_mgr_01');
      expect(verified.email).toBe('bidmanager@acme.com');
      expect(verified.role).toBe('BID_MANAGER');
      expect(verified.organizationId).toBe('org_acme_infra_001');
    });

    it('should reject tampered token signatures with UnauthorizedError', () => {
      const token = tokenService.signAccessToken({
        sub: 'usr_viewer_01',
        email: 'viewer@acme.com',
        name: 'Viewer',
        role: 'VIEWER' as UserRole,
        permissions: [Permissions.BIDS_READ],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme',
      });

      const [header, payload, signature] = token.split('.');
      // Tamper signature by changing a single byte
      const tamperedSignature = signature.slice(0, -2) + (signature.endsWith('a') ? 'b' : 'a');
      const tamperedToken = `${header}.${payload}.${tamperedSignature}`;

      expect(() => tokenService.verifyAccessToken(tamperedToken)).toThrow(UnauthorizedError);
    });

    it('should reject tampered payload even if valid base64url', () => {
      const token = tokenService.signAccessToken({
        sub: 'usr_viewer_01',
        email: 'viewer@acme.com',
        name: 'Viewer',
        role: 'VIEWER' as UserRole,
        permissions: [Permissions.BIDS_READ],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme',
      });

      const [header, , signature] = token.split('.');
      // Forged payload escalating privilege to ADMIN
      const forgedPayloadObj = {
        sub: 'usr_attacker',
        role: 'ADMIN',
        organizationId: 'org_victim_999',
      };
      const forgedPayload = Buffer.from(JSON.stringify(forgedPayloadObj))
        .toString('base64url');
      const forgedToken = `${header}.${forgedPayload}.${signature}`;

      expect(() => tokenService.verifyAccessToken(forgedToken)).toThrow(UnauthorizedError);
    });

    it('should reject expired tokens', () => {
      // Mock Date.now to sign a token in the past
      const realNow = Date.now;
      try {
        const past = 1700000000000;
        Date.now = () => past;
        const expiredToken = tokenService.signAccessToken(
          {
            sub: 'usr_01',
            email: 'user@test.com',
            name: 'User',
            role: 'VIEWER' as UserRole,
            permissions: [],
            organizationId: 'org_01',
            organizationName: 'Org',
          },
          10 // 10 seconds TTL
        );

        // Advance time by 1 hour
        Date.now = () => past + 3600 * 1000;
        expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow('Token has expired');
      } finally {
        Date.now = realNow;
      }
    });

    it('should sign and verify refresh tokens', () => {
      const refreshToken = tokenService.signRefreshToken('usr_bid_mgr_01');
      const verified = tokenService.verifyRefreshToken(refreshToken);
      expect(verified.userId).toBe('usr_bid_mgr_01');
    });

    it('should reject access token passed to verifyRefreshToken (token type defense)', () => {
      const accessToken = tokenService.signAccessToken({
        sub: 'usr_01',
        email: 'user@test.com',
        name: 'User',
        role: 'VIEWER' as UserRole,
        permissions: [],
        organizationId: 'org_01',
        organizationName: 'Org',
      });

      expect(() => tokenService.verifyRefreshToken(accessToken)).toThrow('Invalid refresh token.');
    });
  });

  describe('2. JwtAuthGuard — Global API Authentication Gating', () => {
    it('should reject unauthenticated request with 401 Unauthorized', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === 'isPublic' ? false : undefined);
      const { context } = createMockContext({ headers: {} });

      expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedError);
    });

    it('should allow @Public() routes without token', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === 'isPublic' ? true : undefined);
      const { context } = createMockContext({ headers: {} });

      const canActivate = authGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('should authenticate request with valid Bearer token and attach user to request', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === 'isPublic' ? false : undefined);
      const token = tokenService.signAccessToken({
        sub: 'usr_mgr_01',
        email: 'mgr@acme.com',
        name: 'Manager',
        role: 'BID_MANAGER' as UserRole,
        permissions: [Permissions.BIDS_READ],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme',
      });

      const { context, req } = createMockContext({
        headers: { authorization: `Bearer ${token}` },
      });

      const canActivate = authGuard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user).toBeDefined();
      expect((req.user as Record<string, unknown>).sub).toBe('usr_mgr_01');
    });

    it('should authenticate SSE stream using ?token= query parameter', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === 'isPublic' ? false : undefined);
      const token = tokenService.signAccessToken({
        sub: 'usr_mgr_01',
        email: 'mgr@acme.com',
        name: 'Manager',
        role: 'BID_MANAGER' as UserRole,
        permissions: [Permissions.BIDS_READ],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme',
      });

      const { context, req } = createMockContext({
        headers: {},
        query: { token },
      });

      const canActivate = authGuard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user).toBeDefined();
    });

    it('should reject malformed or forged Bearer token', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === 'isPublic' ? false : undefined);
      const { context } = createMockContext({
        headers: { authorization: 'Bearer invalid.forged.token' },
      });

      expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedError);
    });
  });

  describe('3. RolesGuard — Atomic Permission Enforcement', () => {
    it('should allow route when no @RequirePermission is configured', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(() => undefined);
      const { context } = createMockContext({
        user: { role: 'VIEWER' },
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should throw 403 Forbidden when VIEWER attempts BIDS_DELETE', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'requiredPermissions') return [Permissions.BIDS_DELETE];
        return undefined;
      });
      const { context } = createMockContext({
        user: { role: 'VIEWER', permissions: [] },
      });

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenError);
    });

    it('should allow ADMIN for any permission including BIDS_DELETE', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'requiredPermissions') return [Permissions.BIDS_DELETE];
        return undefined;
      });
      const { context } = createMockContext({
        user: { role: 'ADMIN', permissions: [] },
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should allow BID_MANAGER for BIDS_CREATE and COMPLIANCE_REVIEW', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'requiredPermissions') return [Permissions.BIDS_CREATE, Permissions.COMPLIANCE_REVIEW];
        return undefined;
      });
      const { context } = createMockContext({
        user: { role: 'BID_MANAGER', permissions: [] },
      });

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should throw 401 Unauthorized when unauthenticated caller reaches RolesGuard', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'isPublic') return false;
        if (key === 'requiredPermissions') return [Permissions.BIDS_READ];
        return undefined;
      });
      const { context } = createMockContext({
        user: undefined,
      });

      expect(() => rolesGuard.canActivate(context)).toThrow(UnauthorizedError);
    });
  });

  describe('4. TenantContextInterceptor — Fiber-Safe Isolation', () => {
    it('should populate TenantContextHolder during request and clean up afterwards', async () => {
      const user = {
        organizationId: 'org_acme_infra_001',
        sub: 'usr_bid_mgr_01',
        role: 'BID_MANAGER' as UserRole,
      };
      const { context } = createMockContext({ user });

      let capturedOrgId: string | undefined;
      let capturedUserId: string | undefined;

      const nextHandler: CallHandler = {
        handle: () => {
          // Inside the execution fiber
          const ctx = TenantContextHolder.get();
          capturedOrgId = ctx?.organizationId;
          capturedUserId = ctx?.userId;
          return of({ success: true });
        },
      };

      await new Promise<void>((resolve, reject) => {
        tenantInterceptor.intercept(context, nextHandler).subscribe({
          next: () => resolve(),
          error: (err) => reject(err),
        });
      });

      expect(capturedOrgId).toBe('org_acme_infra_001');
      expect(capturedUserId).toBe('usr_bid_mgr_01');

      // Ensure storage is clean outside fiber
      expect(TenantContextHolder.get()).toBeNull();
    });
  });

  describe('5. AuthService End-to-End Hardening Flow', () => {
    it('should login, generate signed JWTs, and refresh successfully', async () => {
      const loginRes = await authService.login('bidmanager@acme.com', 'Password123!');
      expect(loginRes.accessToken).toBeDefined();
      expect(loginRes.refreshToken).toBeDefined();
      expect(loginRes.user.role).toBe('BID_MANAGER');

      // Verify the returned accessToken is signed by TokenService
      const claims = tokenService.verifyAccessToken(loginRes.accessToken);
      expect(claims.sub).toBe(loginRes.user.id);
      expect(claims.organizationId).toBe('org_acme_infra_001');

      // Refresh token with the genuine refresh token
      const refreshRes = await authService.refresh(loginRes.refreshToken);
      expect(refreshRes.accessToken).toBeDefined();
      expect(refreshRes.refreshToken).toBeDefined();

      const refreshClaims = tokenService.verifyAccessToken(refreshRes.accessToken);
      expect(refreshClaims.sub).toBe(loginRes.user.id);
    });

    it('should reject refresh when token is signed for a nonexistent user', async () => {
      // Sign a valid refresh token for a deleted/nonexistent user ID
      const fakeUserRefreshToken = tokenService.signRefreshToken('usr_ghost_nonexistent');

      await expect(authService.refresh(fakeUserRefreshToken)).rejects.toThrow(
        'User account associated with this refresh token no longer exists.'
      );
    });
  });
});
