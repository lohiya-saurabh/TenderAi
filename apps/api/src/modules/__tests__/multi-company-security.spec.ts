/**
 * Multi-Company Architecture & Anti-IDOR Security Suite
 *
 * Verifies the 1 Tenant -> N Companies domain model:
 * 1. Primary Security Boundary: User -> Tenant (Organization).
 * 2. Scoped Business Entities: Tenant -> N Companies.
 * 3. Strict Anti-IDOR: Tenant A cannot access, query, or mutate Tenant B's companies, profiles, or bids.
 * 4. Company-level Profile Versioning & Bid Isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { CompaniesService } from '../companies/companies.service.js';
import { CompanyProfileService } from '../company-profile/company-profile.service.js';
import { BidsService } from '../bids/bids.service.js';
import { GetBidDecisionUseCase } from '../bids/application/GetBidDecisionUseCase.js';
import { AiDecisionClient, type AiBidDecisionRequest, type AiBidDecisionResponse } from '../bids/application/AiDecisionClient.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';

describe('Multi-Company Security & Workflow Suite (1 Tenant -> N Companies)', () => {
  let db: PGlite;
  let drizzleDb: DrizzleDb;
  let companiesService: CompaniesService;
  let companyProfileService: CompanyProfileService;
  let bidsService: BidsService;
  let getBidDecisionUseCase: GetBidDecisionUseCase;

  const TENANT_A = 'org_acme_infra_001';
  const USER_A_ADMIN = 'usr_admin_01';

  const COMPANY_A1 = 'comp_acme_infra_001';
  const COMPANY_A2 = 'comp_acme_tech_002';
  const COMPANY_B1 = 'comp_bharat_heavy_001';

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    drizzleDb = createDrizzle(db);

    companyProfileService = new CompanyProfileService(drizzleDb);
    companiesService = new CompaniesService(drizzleDb, companyProfileService);
    bidsService = new BidsService(drizzleDb);

    const fakeAiClient = {
      evaluate: async (req: AiBidDecisionRequest): Promise<AiBidDecisionResponse> => ({
        tender_id: req.tender_id,
        company_id: req.company_profile.company_id,
        profile_version_id: req.company_profile.profile_version_id,
        verdict: 'GO',
        state: 'AI_PROPOSED',
        readiness_score: 0.92,
        reasons_to_pursue: [{ title: 'Strong fit', detail: 'Matches criteria' }],
        reasons_not_to_pursue: [],
        hard_disqualifiers: [],
        missing_information: [],
        uncertain_areas: [],
        commercial_risks: [],
        evidence_citations: [],
        review_triggers: [],
      }),
    };

    getBidDecisionUseCase = new GetBidDecisionUseCase(drizzleDb, fakeAiClient as unknown as AiDecisionClient);
  });

  describe('1. Tenant-scoped Company Management', () => {
    it('allows Tenant A to list all companies belonging to Tenant A', async () => {
      const companies = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => companiesService.listCompanies(),
      );

      expect(companies.length).toBe(2);
      const ids = companies.map((c) => c.id);
      expect(ids).toContain(COMPANY_A1);
      expect(ids).toContain(COMPANY_A2);
      // Ensures Tenant B company is NOT returned to Tenant A
      expect(ids).not.toContain(COMPANY_B1);
    });

    it('allows Tenant A to register a new Company within Tenant A', async () => {
      const newComp = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () =>
          companiesService.createCompany({
            legalName: 'Acme Renewable Energy Pvt Ltd',
            slug: 'acme-renewables',
            gstin: '07AAKCA9999F1Z9',
            pan: 'AAKCA9999F',
          }),
      );

      expect(newComp.id).toBeDefined();
      expect(newComp.organizationId).toBe(TENANT_A);
      expect(newComp.legalName).toBe('Acme Renewable Energy Pvt Ltd');

      // Check that it now shows up in list
      const companies = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => companiesService.listCompanies(),
      );
      expect(companies.length).toBe(3);
    });

    it('rejects company creation with empty name (validation check)', async () => {
      await expect(
        TenantContextHolder.run(
          { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
          () => companiesService.createCompany({ legalName: '   ' }),
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('2. Anti-IDOR Security: Cross-Tenant Isolation', () => {
    it('throws NotFoundError when Tenant A attempts to get Tenant B company details by ID', async () => {
      await expect(
        TenantContextHolder.run(
          { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
          () => companiesService.getCompanyById(COMPANY_B1),
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when Tenant A attempts to fetch capability profile of Tenant B company', async () => {
      await expect(
        TenantContextHolder.run(
          { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
          () => companyProfileService.getProfile(COMPANY_B1),
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when Tenant A attempts to pin a new profile version to Tenant B company', async () => {
      await expect(
        TenantContextHolder.run(
          { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
          () =>
            companyProfileService.createProfileVersion(
              'Malicious Profile Version',
              {
                company_name: 'Hijacked Company',
                is_blacklisted: false,
              } as unknown as Parameters<typeof companyProfileService.createProfileVersion>[1],
              COMPANY_B1,
            ),
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('3. Multi-Company Bid Scoping & Isolation', () => {
    it('creates bids explicitly scoped to a company and filters bids by companyId', async () => {
      // Create a bid for Company A1
      const bid1 = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () =>
          bidsService.createBid({
            title: 'Expressway Flyover Tender',
            tenderNumber: 'NIT-EXP-001',
            tenderingAuthority: 'NHAI',
            companyId: COMPANY_A1,
            estimatedValueRupees: 500000000,
          }),
      );

      // Create a bid for Company A2
      const bid2 = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () =>
          bidsService.createBid({
            title: 'Smart Grid IoT Sensor Tender',
            tenderNumber: 'NIT-IOT-002',
            tenderingAuthority: 'NTPC',
            companyId: COMPANY_A2,
            estimatedValueRupees: 120000000,
          }),
      );

      expect(bid1.companyId).toBe(COMPANY_A1);
      expect(bid2.companyId).toBe(COMPANY_A2);

      const getItems = (res: unknown): { id: string }[] =>
        Array.isArray(res) ? res : (res as { items: { id: string }[] }).items;

      // List all bids for Tenant A
      const allTenantABids = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => bidsService.listBids(),
      );
      expect(getItems(allTenantABids).some((b) => b.id === bid1.id)).toBe(true);

      // Filter specifically by Company A1
      const compA1Bids = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => bidsService.listBids({ companyId: COMPANY_A1 }),
      );
      expect(getItems(compA1Bids).some((b) => b.id === bid1.id)).toBe(true);
      expect(getItems(compA1Bids).some((b) => b.id === bid2.id)).toBe(false);

      // Filter specifically by Company A2
      const compA2Bids = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => bidsService.listBids({ companyId: COMPANY_A2 }),
      );
      expect(getItems(compA2Bids).some((b) => b.id === bid2.id)).toBe(true);
      expect(getItems(compA2Bids).some((b) => b.id === bid1.id)).toBe(false);
    });

    it('rejects bid creation if companyId belongs to another tenant', async () => {
      await expect(
        TenantContextHolder.run(
          { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
          () =>
            bidsService.createBid({
              title: 'Cross Tenant Bid Attempt',
              tenderNumber: 'NIT-FAKE-001',
              tenderingAuthority: 'NHAI',
              companyId: COMPANY_B1, // Belongs to Tenant B
            }),
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('4. Company Profile Versioning & Deterministic Evaluation Isolation', () => {
    it('isolates profile versions between Company A1 and Company A2', async () => {
      // Pin a new version for Company A1
      const versionA1 = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () =>
          companyProfileService.createProfileVersion(
            'Company A1 FY27 Profile',
            {
              company_name: 'Acme Infrastructure Solutions Ltd.',
              operating_regions: ['Maharashtra', 'Gujarat'],
              turnover_records: [
                {
                  entry_id: 'to-fy26',
                  financial_year: 'FY26',
                  turnover_inr_crores: 450,
                  evidence_document_id: 'ev-fin-001',
                },
              ],
            },
            COMPANY_A1,
          ),
      );

      // Fetch profile view for Company A1 and Company A2
      const profileA1 = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => companyProfileService.getProfile(COMPANY_A1),
      );

      const profileA2 = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => companyProfileService.getProfile(COMPANY_A2),
      );

      expect(profileA1.active?.id).toBe(versionA1.id);
      expect(profileA1.active?.name).toBe('Company A1 FY27 Profile');
      expect(profileA2.active?.id).not.toBe(versionA1.id);
    });

    it('evaluates bid decision against the correct company profile and persists companyId', async () => {
      // Create a bid for Company A1
      const bid = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () =>
          bidsService.createBid({
            title: 'Bridge Construction Tender',
            tenderNumber: 'NIT-BRG-2026',
            tenderingAuthority: 'NHAI',
            companyId: COMPANY_A1,
            estimatedValueRupees: 800000000,
            submissionDeadline: '2026-11-30',
          }),
      );

      const decision = await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_ADMIN, role: 'ADMIN' },
        () => getBidDecisionUseCase.evaluate(bid.id),
      );

      expect(decision.verdict).toBe('GO');
      expect(decision.readinessScore).toBe(0.92);

      // Verify the persisted decision record contains companyId
      const [savedDecision] = await drizzleDb
        .select()
        .from(schema.bidDecisions)
        .where(eq(schema.bidDecisions.bidId, bid.id));

      expect(savedDecision).toBeDefined();
      expect(savedDecision.companyId).toBe(COMPANY_A1);
      expect(savedDecision.organizationId).toBe(TENANT_A);
    });
  });
});
