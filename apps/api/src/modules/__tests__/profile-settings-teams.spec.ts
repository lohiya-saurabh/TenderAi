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
});
