import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { GetBidDecisionUseCase } from '@/modules/bids/application/GetBidDecisionUseCase.js';
import {
  AiDecisionClient,
  type AiBidDecisionRequest,
  type AiBidDecisionResponse,
} from '@/modules/bids/application/AiDecisionClient.js';
import { NotFoundError, ConflictError } from '@/common/errors/errors.js';

/** Fake engine: captures the request, returns a canned verdict. */
class FakeAiDecisionClient {
  public capturedRequest: AiBidDecisionRequest | null = null;
  public callCount = 0;
  constructor(private readonly canned: AiBidDecisionResponse) {}
  async evaluate(request: AiBidDecisionRequest): Promise<AiBidDecisionResponse> {
    this.callCount += 1;
    this.capturedRequest = request;
    return this.canned;
  }
}

const cannedResponse = (overrides: Partial<AiBidDecisionResponse> = {}): AiBidDecisionResponse => ({
  tender_id: 'bid-dec-01',
  company_id: 'org_acme_infra_001',
  profile_version_id: 'cpv-test-01',
  verdict: 'GO',
  state: 'AI_PROPOSED',
  readiness_score: 0.95,
  reasons_to_pursue: [
    {
      title: 'Exceeds Turnover Threshold',
      detail: 'Company turnover of ₹85.00 Cr satisfies requirement of ₹50.00 Cr.',
      category: 'FINANCIAL',
    },
  ],
  reasons_not_to_pursue: [],
  hard_disqualifiers: [],
  missing_information: [],
  uncertain_areas: [],
  commercial_risks: [],
  evidence_citations: [],
  review_triggers: [],
  ...overrides,
});

describe('GetBidDecisionUseCase — bid/no-bid evaluation pipeline', () => {
  let db: PGlite;
  let drizzleDb: ReturnType<typeof createDrizzle>;
  let fakeClient: FakeAiDecisionClient;
  let useCase: GetBidDecisionUseCase;

  const orgId = 'org_acme_infra_001';
  const rivalOrgId = 'org_rival_infra_999';
  const bidId = 'bid-dec-01';

  const seedBid = async (
    id: string = bidId,
    organizationId: string = orgId,
    opts: { deadline?: string | null; location?: string | null } = {},
  ) => {
    await drizzleDb.insert(schema.bids).values({
      id,
      organizationId,
      companyId: 'comp_acme_infra_001',
      title: 'Construction of Elevated Corridor',
      tenderNumber: 'NHAI/DEL/2026/EC-24',
      tenderingAuthority: 'NHAI',
      estimatedValueRupees: 120000000, // ₹12 Crore
      submissionDeadline: opts.deadline !== undefined ? opts.deadline : '2026-12-31T18:00:00.000Z',
      locationState: opts.location === undefined ? 'Delhi' : opts.location,
      status: 'DRAFT',
      totalRequirements: 0,
      flaggedRequirements: 0,
      approvedRequirements: 0,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const seedComplianceItem = async (bid: string = bidId) => {
    await drizzleDb.insert(schema.complianceItems).values({
      id: 'ci-01',
      bidId: bid,
      organizationId: orgId,
      category: 'FINANCIAL',
      title: 'Minimum Annual Turnover',
      description: 'Bidder must have a minimum average annual turnover of ₹50 Crores',
      status: 'PENDING',
      humanReviewRequired: true,
      version: 1,
      executionRules: {
        stampPaperRequired: false,
        notarizationRequired: false,
        udinRequired: true,
        signingAuthorityRank: 'Director',
      },
      provenance: {
        documentId: 'doc-01',
        documentName: 'NIT.pdf',
        pageNumber: 14,
        sectionOrClause: 'Clause 5.1',
        verbatimQuote:
          'The bidder shall have an average annual turnover of not less than ₹50 Crores',
        confidenceScore: 0.94,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const seedDocument = async (bid: string = bidId) => {
    await drizzleDb.insert(schema.tenderDocuments).values({
      id: 'doc-01',
      bidId: bid,
      organizationId: orgId,
      fileName: 'NIT.pdf',
      storagePath: `tenants/${orgId}/bids/${bid}/doc-01/NIT.pdf`,
      fileSizeBytes: 4200000,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'UPLOADED',
      uploadedAt: new Date(),
    });
  };

  const seedProfile = async (organizationId: string = orgId) => {
    await drizzleDb.insert(schema.companyProfileVersions).values({
      id: 'cpv-test-01',
      companyId: 'comp_acme_infra_001',
      organizationId,
      version: 1,
      name: 'FY26 Capability Profile',
      payload: {
        company_name: 'Acme Infrastructure Solutions Ltd.',
        is_blacklisted: false,
        registrations: { GSTIN: '07AAKCA1234F1Z5', UDYAM: 'UDYAM-DL-01-0001234' },
        operating_regions: ['Delhi', 'Haryana'],
        turnover_records: [
          {
            financial_year: 'FY25',
            turnover_inr_crores: 85,
            ca_udin: '234567890123',
            evidence_document_id: 'ev-fin-fy25',
          },
        ],
        experience: [],
        certifications: [],
        oem_authorizations: [],
        staff: [],
        equipment: [],
      },
      createdBy: 'usr_admin_01',
      createdAt: new Date(),
    });
    await drizzleDb.insert(schema.companyProfiles).values({
      id: `cp-${organizationId}-default`,
      companyId: 'comp_acme_infra_001',
      organizationId,
      activeVersionId: 'cpv-test-01',
      updatedAt: new Date(),
    });
  };

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, {
      seedUsers: false,
      seedFullProfile: false,
      seedBidsAndCompliance: false,
    });
    drizzleDb = createDrizzle(db);

    await drizzleDb
      .insert(schema.companies)
      .values([
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
      ])
      .onConflictDoNothing();

    fakeClient = new FakeAiDecisionClient(cannedResponse());
    // Structural typing: the fake satisfies the AiDecisionClient contract.
    useCase = new GetBidDecisionUseCase(drizzleDb, fakeClient as unknown as AiDecisionClient);
  });

  it('evaluates a bid against the pinned profile and persists the decision', async () => {
    await seedBid();
    await seedDocument();
    await seedComplianceItem();
    await seedProfile();

    const result = await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.evaluate(bidId),
    );

    expect(result.verdict).toBe('GO');
    expect(result.state).toBe('AI_PROPOSED');
    expect(result.readinessScore).toBe(0.95);
    expect(result.profileVersionId).toBe('cpv-test-01');
    expect(result.decisionId).toContain('bd-');
    expect(fakeClient.callCount).toBe(1);
  });

  it('assembles a correct engine request (crores conversion, deadline date, security context, mapped requirements)', async () => {
    await seedBid();
    await seedDocument();
    await seedComplianceItem();
    await seedProfile();

    await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.evaluate(bidId),
    );

    const req = fakeClient.capturedRequest!;
    expect(req.tender_id).toBe(bidId);
    expect(req.tender_title).toBe('Construction of Elevated Corridor');
    // ₹120,000,000 = ₹12 Crore
    expect(req.estimated_value_inr_crores).toBe(12);
    expect(req.submission_deadline).toBe('2026-12-31');
    expect(req.project_location_state).toBe('Delhi');
    expect(req.require_human_review).toBe(true);

    // Security context: explicit BID_DECISION purpose, tenant-scoped
    expect(req.security_context.purpose).toBe('BID_DECISION');
    expect(req.security_context.tenant_id).toBe(orgId);
    expect(req.security_context.user_id).toBe('usr_bid_mgr_01');
    expect(req.security_context.allowed_document_ids).toEqual(['doc-01']);

    // Requirement mapping
    expect(req.requirements).toHaveLength(1);
    expect(req.requirements[0].category).toBe('FINANCIAL');
    expect(req.requirements[0].criticality).toBe('HARD_ELIGIBILITY');
    expect(req.requirements[0].kind).toBe('ELIGIBILITY_THRESHOLD');
    expect(req.requirements[0].provenance.verbatim_quote).toContain('₹50 Crores');
    expect(req.requirements[0].execution_rules.udin_required).toBe(true);
    expect(req.requirements[0].execution_rules.signing_authority_rank).toBe('Director');

    // Company profile pass-through
    expect(req.company_profile.company_name).toBe('Acme Infrastructure Solutions Ltd.');
    expect(req.company_profile.profile_version_id).toBe('cpv-test-01');
    expect(req.company_profile.operating_regions).toEqual(['Delhi', 'Haryana']);
    expect(req.company_profile.turnover_records).toHaveLength(1);
    expect(req.company_profile.turnover_records?.[0].turnover_inr_crores).toBe(85);
  });

  it('falls back to UNSPECIFIED location when the bid has none', async () => {
    await seedBid(bidId, orgId, { location: null });
    await seedDocument();
    await seedComplianceItem();
    await seedProfile();

    await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.evaluate(bidId),
    );

    expect(fakeClient.capturedRequest!.project_location_state).toBe('UNSPECIFIED');
  });

  it('retrieves the latest persisted decision', async () => {
    await seedBid();
    await seedDocument();
    await seedComplianceItem();
    await seedProfile();

    await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.evaluate(bidId),
    );

    const latest = await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.getLatestDecision(bidId),
    );

    expect(latest).not.toBeNull();
    expect(latest!.verdict).toBe('GO');
    expect(latest!.response.reasons_to_pursue[0]).toMatchObject({
      title: 'Exceeds Turnover Threshold',
    });
  });

  it('returns null when the bid has never been evaluated', async () => {
    await seedBid();
    const latest = await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.getLatestDecision(bidId),
    );
    expect(latest).toBeNull();
  });

  it('keeps every evaluation as an immutable append-only record', async () => {
    await seedBid();
    await seedDocument();
    await seedComplianceItem();
    await seedProfile();

    await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.evaluate(bidId),
    );
    const second = cannedResponse({ verdict: 'NO_GO', readiness_score: 0.3 });
    const secondClient = new FakeAiDecisionClient(second);
    const secondUseCase = new GetBidDecisionUseCase(
      drizzleDb,
      secondClient as unknown as AiDecisionClient,
    );
    await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => secondUseCase.evaluate(bidId),
    );

    const rows = await drizzleDb
      .select()
      .from(schema.bidDecisions)
      .where(eq(schema.bidDecisions.bidId, bidId));
    expect(rows).toHaveLength(2);
    // Latest (most recent) wins
    const latest = await TenantContextHolder.run(
      { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
      () => useCase.getLatestDecision(bidId),
    );
    expect(latest!.verdict).toBe('NO_GO');
  });

  it('throws 409 when no Company Capability Profile is pinned', async () => {
    await seedBid();
    await seedDocument();
    await seedComplianceItem();
    // No profile seeded

    await expect(
      TenantContextHolder.run(
        { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
        () => useCase.evaluate(bidId),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      TenantContextHolder.run(
        { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
        () => useCase.evaluate(bidId),
      ),
    ).rejects.toThrow(/No Company Capability Profile is configured/);
    expect(fakeClient.callCount).toBe(0);
  });

  it('throws 404 for unknown bids (anti-IDOR: tenant boundary enforced)', async () => {
    await seedBid(bidId, orgId);
    await seedProfile();

    // Rival tenant cannot see org A's bid
    await expect(
      TenantContextHolder.run(
        { organizationId: rivalOrgId, userId: 'usr_rival_01', role: 'BID_MANAGER' },
        () => useCase.evaluate(bidId),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Unknown bid id for the right tenant
    await expect(
      TenantContextHolder.run(
        { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
        () => useCase.evaluate('bid-does-not-exist'),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws 400 when the bid has no submission deadline', async () => {
    await seedBid(bidId, orgId, { deadline: null });
    await seedProfile();

    await expect(
      TenantContextHolder.run(
        { organizationId: orgId, userId: 'usr_bid_mgr_01', role: 'BID_MANAGER' },
        () => useCase.evaluate(bidId),
      ),
    ).rejects.toThrow(/deadline is required/);
    expect(fakeClient.callCount).toBe(0);
  });
});
