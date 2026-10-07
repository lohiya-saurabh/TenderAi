import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle } from '../../common/database/database.module.js';
import { eq } from 'drizzle-orm';
import * as schema from '../../common/database/schema.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { CompanyProfileService } from './company-profile.service.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';
import type { CompanyProfilePayload } from './presentation/dto/CompanyProfilePayload.js';

describe('CompanyProfileService — versioned capability profile', () => {
  let db: PGlite;
  let drizzleDb: ReturnType<typeof createDrizzle>;
  let service: CompanyProfileService;

  const orgId = 'org_acme_infra_001';
  const rivalOrgId = 'org_rival_infra_999';

  const validPayload = (
    overrides: Partial<CompanyProfilePayload> = {},
  ): CompanyProfilePayload => ({
    company_name: 'Acme Infrastructure Solutions Ltd.',
    is_blacklisted: false,
    registrations: { GSTIN: '07AAKCA1234F1Z5' },
    operating_regions: ['Delhi'],
    turnover_records: [
      {
        entry_id: 'tr-01',
        financial_year: 'FY25',
        turnover_inr_crores: 85,
        ca_udin: '234567890123',
        evidence_document_id: 'ev-001',
      },
    ],
    experience: [
      {
        entry_id: 'exp-01',
        project_name: 'NH-48 Flyover',
        client_name: 'NHAI',
        contract_value_inr_crores: 40,
        completion_date: '2024-06-30',
        work_type_tags: ['highway'],
        location_state: 'Haryana',
        evidence_document_id: 'ev-exp-01',
      },
    ],
    certifications: [],
    oem_authorizations: [],
    staff: [],
    equipment: [],
    ...overrides,
  });

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: false, seedFullProfile: false, seedBidsAndCompliance: false });
    drizzleDb = createDrizzle(db);
    service = new CompanyProfileService(drizzleDb);

    await drizzleDb.insert(schema.companies).values([
      {
        id: 'comp_acme_infra_001',
        organizationId: orgId,
        legalName: 'Acme Infrastructure Solutions Ltd.',
      },
      {
        id: 'comp_rival_infra_999',
        organizationId: rivalOrgId,
        legalName: 'Rival Infrastructure Ltd.',
      },
    ]).onConflictDoNothing();
  });

  const run = <T>(fn: () => Promise<T>) =>
    TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_admin_01', role: 'ADMIN' },
      fn,
    );

  it('returns empty state when no profile exists', async () => {
    const view = await run(() => service.getProfile());
    expect(view.active).toBeNull();
    expect(view.versions).toEqual([]);
  });

  it('pins a new version as active (version 1)', async () => {
    const created = await run(() =>
      service.createProfileVersion('FY26 Profile', validPayload()),
    );
    expect(created.version).toBe(1);
    expect(created.name).toBe('FY26 Profile');
    expect(created.payload.company_name).toBe(
      'Acme Infrastructure Solutions Ltd.',
    );

    const view = await run(() => service.getProfile());
    expect(view.active?.id).toBe(created.id);
    expect(view.versions).toHaveLength(1);
  });

  it('creates immutable append-only versions and re-points active', async () => {
    const first = await run(() =>
      service.createProfileVersion('v1', validPayload()),
    );
    const second = await run(() =>
      service.createProfileVersion(
        'v2',
        validPayload({
          operating_regions: ['Delhi', 'Punjab'],
          turnover_records: [
            {
              entry_id: 'tr-02',
              financial_year: 'FY26',
              turnover_inr_crores: 120,
              evidence_document_id: 'ev-002',
            },
          ],
        }),
      ),
    );

    expect(second.version).toBe(2);
    expect(second.id).not.toBe(first.id);

    const view = await run(() => service.getProfile());
    expect(view.active?.id).toBe(second.id);
    expect(view.versions).toHaveLength(2);
    // v1 remains immutable and retrievable
    const v1 = await run(() => service.getVersionById(first.id));
    expect(v1.payload.operating_regions).toEqual(['Delhi']);
    expect(v1.version).toBe(1);
  });

  it('rejects invalid payloads at the API boundary', async () => {
    // Missing company_name
    await expect(
      run(() => service.createProfileVersion('bad', { foo: 'bar' })),
    ).rejects.toThrow(/company_name is required/);

    // Negative turnover — invalid data (entry_id included but value negative)
    await expect(
      run(() =>
        service.createProfileVersion(
          'bad',
          validPayload({
            turnover_records: [
              {
                entry_id: 'tr-bad',
                financial_year: 'FY',
                turnover_inr_crores: -5,
                evidence_document_id: 'ev-001',
              },
            ],
          }),
        ),
      ),
    ).rejects.toThrow(/validation failed/);
  });

  it('enforces tenant boundary on version lookup (anti-IDOR)', async () => {
    const created = await run(() =>
      service.createProfileVersion('FY26', validPayload()),
    );

    await expect(
      TenantContextHolder.run(
        { organizationId: rivalOrgId, userId: 'usr_rival', role: 'BID_MANAGER' },
        () => service.getVersionById(created.id),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('requires tenant context', async () => {
    await expect(service.getProfile()).rejects.toBeInstanceOf(BadRequestError);
  });

  it('generates a default name when none is provided', async () => {
    const created = await run(() =>
      service.createProfileVersion('', validPayload()),
    );
    expect(created.name).toBe('Profile v1');
  });

  it('stores the payload as JSONB and reads it back intact', async () => {
    const payload = validPayload({
      experience: [
        {
          entry_id: 'exp-01',
          project_name: 'NH-48 Flyover',
          client_name: 'NHAI',
          contract_value_inr_crores: 40,
          completion_date: '2024-06-30',
          work_type_tags: ['highway', 'flyover'],
          location_state: 'Haryana',
          evidence_document_id: 'ev-exp-01',
        },
      ],
      certifications: [
        {
          entry_id: 'cert-01',
          standard_name: 'ISO 9001',
          issuing_body: 'Bureau Veritas',
          valid_from: '2023-01-01',
          valid_to: '2027-01-01',
          evidence_document_id: 'ev-cert-01',
        },
      ],
    });

    const created = await run(() =>
      service.createProfileVersion('Full', payload),
    );

    const [row] = await drizzleDb
      .select()
      .from(schema.companyProfileVersions)
      .where(eq(schema.companyProfileVersions.id, created.id));
    expect(row).toBeDefined();
    const stored =
      typeof row!.payload === 'string'
        ? JSON.parse(row!.payload)
        : row!.payload;
    expect((stored as CompanyProfilePayload).experience).toHaveLength(1);
    expect((stored as CompanyProfilePayload).certifications?.[0].standard_name).toBe(
      'ISO 9001',
    );
  });
});
