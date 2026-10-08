import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import { AuthService } from '../auth/auth.service.js';
import { BillingService } from '../billing/billing.service.js';
import { EntitlementService } from '../billing/entitlement.service.js';
import { CompaniesService } from '../companies/companies.service.js';
import { CompanyProfileService } from '../company-profile/company-profile.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { ForbiddenError, ConflictError } from '../../common/errors/errors.js';

describe('Tenant Registration, Billing & Entitlements Engine Suite', () => {
  let pglite: PGlite;
  let authService: AuthService;
  let billingService: BillingService;
  let entitlementService: EntitlementService;
  let companiesService: CompaniesService;
  let teamsService: TeamsService;

  beforeEach(async () => {
    pglite = new PGlite();
    await initDatabase(pglite, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });

    authService = new AuthService(pglite);
    billingService = new BillingService(pglite);
    entitlementService = new EntitlementService(pglite);
    const profileService = new CompanyProfileService(pglite);
    companiesService = new CompaniesService(pglite, profileService, entitlementService);
    teamsService = new TeamsService(pglite, entitlementService);
  });

  describe('1. User Registration & Atomic Tenant Provisioning', () => {
    it('should register new user, provision tenant, initial free subscription, and first company', async () => {
      const result = await authService.register({
        email: 'aarav@sharma-infra.in',
        password: 'Password123!',
        name: 'Aarav Sharma',
        organizationName: 'Sharma Infrastructure Group',
        companyName: 'Sharma Highway Projects Pvt Ltd',
        gstin: '27AABCS1234Q1Z8',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('aarav@sharma-infra.in');
      expect(result.user.name).toBe('Aarav Sharma');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.organizationName).toBe('Sharma Infrastructure Group');
      expect(result.company?.legalName).toBe('Sharma Highway Projects Pvt Ltd');

      // Verify subscription created
      const sub = await billingService.getSubscription(result.user.organizationId);
      expect(sub.planTier).toBe('FREE');
      expect(sub.status).toBe('ACTIVE');
      expect(sub.entitlements['companies.max']).toBe(1);
    });

    it('should reject registration if email is already registered', async () => {
      await authService.register({
        email: 'duplicate@test.com',
        password: 'Password123!',
        name: 'Duplicate User',
      });

      await expect(
        authService.register({
          email: 'duplicate@test.com',
          password: 'Password456!',
          name: 'Another User',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('2. Billing Plans, Subscriptions & Upgrades', () => {
    it('should return complete public plan catalog', () => {
      const plans = billingService.getPlans();
      expect(plans.length).toBe(5);
      const tiers = plans.map((p) => p.tier);
      expect(tiers).toEqual(['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE']);
    });

    it('should allow tenant to upgrade plan and reflect updated entitlements', async () => {
      const reg = await authService.register({
        email: 'billing@test.com',
        password: 'Password123!',
        name: 'Billing Admin',
      });

      // Initial Free plan
      let sub = await billingService.getSubscription(reg.user.organizationId);
      expect(sub.planTier).toBe('FREE');
      expect(sub.entitlements['companies.max']).toBe(1);

      // Upgrade to Growth
      sub = await billingService.changePlan(reg.user.organizationId, {
        planTier: 'GROWTH',
        billingInterval: 'ANNUAL',
      });

      expect(sub.planTier).toBe('GROWTH');
      expect(sub.billingInterval).toBe('ANNUAL');
      expect(sub.entitlements['companies.max']).toBe(5);
      expect(sub.entitlements['tender_analyses.monthly']).toBe(50);
    });
  });

  describe('3. Entitlement Limit Enforcement', () => {
    it('should block adding more companies than allowed by current plan', async () => {
      const reg = await authService.register({
        email: 'limits@test.com',
        password: 'Password123!',
        name: 'Limits Test',
        companyName: 'Company 1',
      });

      await TenantContextHolder.run(
        {
          organizationId: reg.user.organizationId,
          userId: reg.user.id,
          role: 'ADMIN',
        },
        async () => {
          // Free plan allows 1 company (which was created during registration)
          await expect(
            companiesService.createCompany({
              legalName: 'Company 2',
            }),
          ).rejects.toThrow(ForbiddenError);

          // Upgrade to Growth (allows 5)
          await billingService.changePlan(reg.user.organizationId, { planTier: 'GROWTH' });

          // Now adding second company succeeds
          const comp2 = await companiesService.createCompany({
            legalName: 'Company 2',
          });
          expect(comp2.legalName).toBe('Company 2');
        },
      );
    });

    it('should enforce team member invitation limits based on plan tier', async () => {
      const reg = await authService.register({
        email: 'team-limit@test.com',
        password: 'Password123!',
        name: 'Team Admin',
      });

      await TenantContextHolder.run(
        {
          organizationId: reg.user.organizationId,
          userId: reg.user.id,
          role: 'ADMIN',
        },
        async () => {
          // Free plan allows 1 user (the admin)
          await expect(
            teamsService.inviteMember({
              email: 'member2@test.com',
              name: 'Second User',
              role: 'BID_MANAGER',
            }),
          ).rejects.toThrow(ForbiddenError);

          // Upgrade to Starter (allows 3 users)
          await billingService.changePlan(reg.user.organizationId, { planTier: 'STARTER' });

          const invited = await teamsService.inviteMember({
            email: 'member2@test.com',
            name: 'Second User',
            role: 'BID_MANAGER',
          });
          expect(invited.email).toBe('member2@test.com');
        },
      );
    });

    it('should track and enforce monthly tender analysis limits', async () => {
      const reg = await authService.register({
        email: 'analysis-limit@test.com',
        password: 'Password123!',
        name: 'Analysis Admin',
      });

      const orgId = reg.user.organizationId;

      // Free plan allows 3 analyses
      await entitlementService.recordAnalysisUsage(orgId);
      await entitlementService.recordAnalysisUsage(orgId);
      await entitlementService.recordAnalysisUsage(orgId);

      // 4th analysis should throw ForbiddenError
      await expect(entitlementService.checkTenderAnalysisLimit(orgId)).rejects.toThrow(ForbiddenError);

      // Upgrade to Growth (allows 50)
      await billingService.changePlan(orgId, { planTier: 'GROWTH' });
      await expect(entitlementService.checkTenderAnalysisLimit(orgId)).resolves.not.toThrow();
    });
  });
});
