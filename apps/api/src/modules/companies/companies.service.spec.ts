import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { CompaniesService } from '@/modules/companies/companies.service.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';

describe('CompaniesService — onboarding preferences', () => {
  let drizzleDb: ReturnType<typeof createDrizzle>;
  let service: CompaniesService;
  let profileService: CompanyProfileService;

  const orgId = 'org_acme_infra_001';
  const rivalOrgId = 'org_rival_infra_999';
  const companyId = 'comp_acme_infra_001';
  const rivalCompanyId = 'comp_rival_infra_999';

  beforeEach(async () => {
    const db = new PGlite();
    await initDatabase(db, {
      seedUsers: false,
      seedFullProfile: false,
      seedBidsAndCompliance: false,
    });
    drizzleDb = createDrizzle(db);
    profileService = new CompanyProfileService(drizzleDb);
    service = new CompaniesService(drizzleDb, profileService);

    await drizzleDb
      .insert(schema.companies)
      .values([
        { id: companyId, organizationId: orgId, legalName: 'Acme Infrastructure Solutions Ltd.' },
        { id: rivalCompanyId, organizationId: rivalOrgId, legalName: 'Rival Infra Pvt. Ltd.' },
      ])
      .onConflictDoNothing();
  });

  const run = <T>(fn: () => Promise<T>) =>
    TenantContextHolder.run({ organizationId: orgId, userId: 'usr_admin_01', role: 'ADMIN' }, fn);

  it('stores trimmed, de-duplicated sectors and the turnover band on the company', async () => {
    const updated = await run(() =>
      service.updateOnboardingPreferences(companyId, {
        sectors: [
          ' Solar & Renewable EPC ',
          'Solar & Renewable EPC',
          'Building Construction & MEP',
        ],
        turnoverBand: '10_to_50_cr',
      }),
    );

    expect(updated.onboardingPreferences?.sectors).toEqual([
      'Solar & Renewable EPC',
      'Building Construction & MEP',
    ]);
    expect(updated.onboardingPreferences?.turnoverBand).toBe('10_to_50_cr');

    const reloaded = await run(() => service.getCompanyById(companyId));
    expect(reloaded.onboardingPreferences).toEqual(updated.onboardingPreferences);
  });

  it('never creates or changes a capability profile version', async () => {
    await run(() =>
      service.updateOnboardingPreferences(companyId, {
        sectors: ['Civil Infrastructure & Highways'],
        turnoverBand: '50_to_250_cr',
      }),
    );

    const profile = await run(() => service.getCompanyProfile(companyId));
    expect(profile.active).toBeNull();
    expect(profile.versions).toEqual([]);
  });

  it('rejects an unknown turnover band', async () => {
    await expect(
      run(() =>
        service.updateOnboardingPreferences(companyId, {
          sectors: ['Civil Infrastructure & Highways'],
          turnoverBand: '9000_cr',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects sectors that are not a list of non-empty strings', async () => {
    for (const sectors of [undefined, 'Civil', [''], [42], Array(21).fill('Sector')]) {
      await expect(
        run(() =>
          service.updateOnboardingPreferences(companyId, { sectors, turnoverBand: 'under_10_cr' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestError);
    }
  });

  it("refuses to update another tenant's company (anti-IDOR)", async () => {
    await expect(
      run(() =>
        service.updateOnboardingPreferences(rivalCompanyId, {
          sectors: ['Civil Infrastructure & Highways'],
          turnoverBand: 'under_10_cr',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('fetches a pinned profile version only through its own company', async () => {
    const created = await run(() =>
      profileService.createProfileVersion('FY26', { company_name: 'Acme' }, companyId),
    );

    const fetched = await run(() => service.getCompanyProfileVersion(companyId, created.id));
    expect(fetched.id).toBe(created.id);

    await expect(
      run(() => service.getCompanyProfileVersion(rivalCompanyId, created.id)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
