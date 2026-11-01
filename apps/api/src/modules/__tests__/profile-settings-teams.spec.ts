/**
 * Profile, Workspace Settings & Teams Management Test Suite
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '../../common/database/database.module.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { UsersService } from '../users/users.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { UnauthorizedError } from '../../common/errors/errors.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as schema from '../../common/database/schema.js';
import { AuthService } from '../auth/auth.service.js';

describe('Profile, Settings & Teams Integration Suite', () => {
  let db: PGlite;
  let drizzleDb: DrizzleDb;
  let usersService: UsersService;
  let settingsService: SettingsService;
  let teamsService: TeamsService;

  const TENANT_A = 'org_acme_infra_001';
  const USER_A_ADMIN = 'usr_bid_mgr_01';

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    drizzleDb = createDrizzle(db);

    usersService = new UsersService(drizzleDb);
    settingsService = new SettingsService(drizzleDb);
    teamsService = new TeamsService(drizzleDb);
  });

  describe('1. UsersService — Profile & Password Management', () => {
    it('fetches authenticated user profile', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const profile = await usersService.getMe();
          expect(profile).toBeDefined();
          expect(profile.id).toBe(USER_A_ADMIN);
          expect(profile.email).toBe('bidmanager@acme.com');
          expect(profile.organizationId).toBe(TENANT_A);
        },
      );
    });

    it('updates user display name and phone', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const updated = await usersService.updateMe({
            name: 'Aarav Sharma Updated',
            phone: '+91 99999 88888',
          });

          expect(updated.name).toBe('Aarav Sharma Updated');
          expect(updated.phone).toBe('+91 99999 88888');

          const refetched = await usersService.getMe();
          expect(refetched.name).toBe('Aarav Sharma Updated');
          expect(refetched.phone).toBe('+91 99999 88888');
        },
      );
    });

    it('rejects password change with incorrect current password', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          await expect(
            usersService.changePassword({
              currentPassword: 'WrongPassword123!',
              newPassword: 'BrandNewPassword@2026',
            }),
          ).rejects.toThrow(UnauthorizedError);
        },
      );
    });

    it('successfully changes password with valid current password', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const result = await usersService.changePassword({
            currentPassword: 'Password123!',
            newPassword: 'SuperSecretNewPassword@2026',
          });

          expect(result.success).toBe(true);
        },
      );
    });
  });

  describe('2. SettingsService — Tenant Workspace Configuration', () => {
    it('retrieves and auto-provisions workspace settings on first access', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const settings = await settingsService.getWorkspaceSettings();
          expect(settings).toBeDefined();
          expect(settings.organizationId).toBe(TENANT_A);
          expect(settings.notificationPreferences.notifyDeadlines).toBe(true);
        },
      );
    });

    it('updates notification preferences and default company', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const updated = await settingsService.updateWorkspaceSettings({
            defaultCompanyId: 'comp_acme_tech_002',
            notificationPreferences: {
              notifyDeadlines: false,
              notifyHighRiskFlags: true,
            },
          });

          expect(updated.defaultCompanyId).toBe('comp_acme_tech_002');
          expect(updated.notificationPreferences.notifyDeadlines).toBe(false);
          expect(updated.notificationPreferences.notifyHighRiskFlags).toBe(true);
        },
      );
    });

    it('updates organization name and reflects across workspace settings', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const updated = await settingsService.updateWorkspaceSettings({
            organizationName: 'Acme Global Infrastructure Holdings',
          });

          expect(updated.organizationName).toBe('Acme Global Infrastructure Holdings');

          const refetched = await settingsService.getWorkspaceSettings();
          expect(refetched.organizationName).toBe('Acme Global Infrastructure Holdings');
        },
      );
    });
  });

  describe('3. TeamsService — Member Provisioning & RBAC', () => {
    it('lists team members belonging to tenant', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const members = await teamsService.listMembers();
          expect(members.length).toBeGreaterThan(0);
          expect(members.every((m) => m.organizationId === TENANT_A)).toBe(true);
        },
      );
    });

    it('provisions a new team member with assigned role permissions', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        async () => {
          const invited = await teamsService.inviteMember({
            email: 'priya.legal@acmeinfra.com',
            name: 'Priya Verma',
            role: 'LEGAL_COUNSEL',
          });

          expect(invited.email).toBe('priya.legal@acmeinfra.com');
          expect(invited.name).toBe('Priya Verma');
          expect(invited.role).toBe('LEGAL_COUNSEL');
          expect(invited.organizationId).toBe(TENANT_A);
          expect(invited.permissions).toContain('compliance:review');
        },
      );
    });
  });

  describe('4. Invite links (no shared password)', () => {
    const asAdmin = <T>(fn: () => Promise<T>) =>
      TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        fn,
      );
    const tokenOf = (url: string) => new URL(url).searchParams.get('token') as string;

    it('issues a one-time link and stores only its hash', async () => {
      const invited = await asAdmin(() =>
        teamsService.inviteMember({
          email: 'new.member@acmeinfra.com',
          name: 'New Member',
          role: 'VIEWER',
        }),
      );
      expect(invited.invitePending).toBe(true);
      const token = tokenOf(invited.inviteUrl);
      expect(token.length).toBeGreaterThan(30);
      const [row] = await drizzleDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, invited.id));
      expect(row!.inviteTokenHash).not.toBe(token);
      expect(await bcrypt.compare('TenderPulse@2026', row!.password)).toBe(false);
    });

    it('accepting sets the password, signs in, and works only once', async () => {
      const auth = new AuthService(drizzleDb);
      const invited = await asAdmin(() =>
        teamsService.inviteMember({
          email: 'joiner@acmeinfra.com',
          name: 'Joiner',
          role: 'VIEWER',
        }),
      );
      const token = tokenOf(invited.inviteUrl);
      const session = await auth.acceptInvite(token, 'MyOwnPassword#1');
      expect(session.user.id).toBe(invited.id);
      expect((await auth.login('joiner@acmeinfra.com', 'MyOwnPassword#1')).user.id).toBe(
        invited.id,
      );
      await expect(auth.acceptInvite(token, 'AnotherPass#22')).rejects.toThrow(UnauthorizedError);
    });

    it('rejects an expired link', async () => {
      const auth = new AuthService(drizzleDb);
      const invited = await asAdmin(() =>
        teamsService.inviteMember({ email: 'late@acmeinfra.com', name: 'Late', role: 'VIEWER' }),
      );
      await drizzleDb
        .update(schema.users)
        .set({ inviteExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.users.id, invited.id));
      await expect(
        auth.acceptInvite(tokenOf(invited.inviteUrl), 'MyOwnPassword#1'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('refuses the retired shared password even where it is still stored', async () => {
      const auth = new AuthService(drizzleDb);
      await drizzleDb
        .update(schema.users)
        .set({ password: await bcrypt.hash('TenderPulse@2026', 4) })
        .where(eq(schema.users.id, USER_A_ADMIN));
      await expect(auth.login('bidmanager@acme.com', 'TenderPulse@2026')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('reissues a link only inside the caller tenant', async () => {
      const invited = await asAdmin(() =>
        teamsService.inviteMember({ email: 'again@acmeinfra.com', name: 'Again', role: 'VIEWER' }),
      );
      const fresh = await asAdmin(() => teamsService.reissueInvite(invited.id));
      expect(tokenOf(fresh.inviteUrl)).not.toBe(tokenOf(invited.inviteUrl));
      await expect(
        TenantContextHolder.run({ organizationId: 'org_other', userId: 'x', role: 'ADMIN' }, () =>
          teamsService.reissueInvite(invited.id),
        ),
      ).rejects.toThrow();
    });
  });
});
