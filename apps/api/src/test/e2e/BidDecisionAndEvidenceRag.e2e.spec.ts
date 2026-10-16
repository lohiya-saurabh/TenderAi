import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import {
  CompanyEvidenceService,
  parseFlexibleDate,
} from '@/modules/company-verification/application/CompanyEvidenceService.js';
import { AiEvidenceExtractor } from '@/modules/company-verification/application/AiEvidenceExtractor.js';
import { GetBidDecisionUseCase } from '@/modules/bids/application/GetBidDecisionUseCase.js';
import {
  AiDecisionClient,
  type AiBidDecisionRequest,
} from '@/modules/bids/application/AiDecisionClient.js';
import { toRequirementCandidate } from '@/modules/bids/application/RequirementMapper.js';
import { MockStorageService } from '@/infrastructure/storage/MockStorageService.js';
import { NotFoundError } from '@/common/errors/errors.js';

describe('E2E: Bid/No-Bid Decision & Company Evidence Extraction Pipeline', () => {
  let pglite: PGlite;
  let db: DrizzleDb;
  let storageService: MockStorageService;
  let evidenceExtractor: AiEvidenceExtractor;
  let evidenceService: CompanyEvidenceService;
  let aiDecisionClient: AiDecisionClient;
  let getBidDecisionUseCase: GetBidDecisionUseCase;

  const TEST_ORG_ID = 'org_acme_infra_001';
  const OTHER_ORG_ID = 'org_foreign_999';
  const TEST_COMPANY_ID = 'comp_acme_infra_001';
  const TEST_BID_ID = 'bid_highway_tender_101';

  beforeEach(async () => {
    pglite = new PGlite();
    await pglite.waitReady;
    await initDatabase(pglite, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: false,
    });
    db = createDrizzle(pglite);

    // Clear pre-seeded evidence vault documents & chunks so tests verify their own uploads cleanly
    await db.delete(schema.companyEvidenceChunks);
    await db.delete(schema.companyEvidenceDocuments);

    storageService = new MockStorageService();
    evidenceExtractor = new AiEvidenceExtractor();
    evidenceService = new CompanyEvidenceService(db, storageService, undefined, undefined, undefined, evidenceExtractor);

    // In-process deterministic decision client
    aiDecisionClient = new AiDecisionClient();
    getBidDecisionUseCase = new GetBidDecisionUseCase(db, aiDecisionClient);

    // Set Tenant Context
    TenantContextHolder.enter({
      organizationId: TEST_ORG_ID,
      userId: 'usr_bid_evaluator_01',
      role: 'ADMIN',
    });
  });

  afterEach(async () => {
    TenantContextHolder.setFallback(null);
    await pglite.close();
  });

  it('1. should upload evidence and automatically extract structured attributes and chunks into company_evidence_chunks', async () => {
    // 1A. Upload CA Turnover Certificate
    const turnoverPdfText =
      'CHARTERED ACCOUNTANTS CERTIFICATE\n' +
      'This is to certify that M/s E2E Infrastructure Developers Private Limited has achieved the following turnover:\n' +
      'FY 2022-23: INR 240.20 Crores\n' +
      'FY 2023-24: INR 285.00 Crores\n' +
      'FY 2024-25: INR 320.50 Crores\n' +
      'Average Annual Turnover: INR 281.90 Crores\n' +
      'UDIN: 25089745AAAAAA1234\n' +
      'For V. K. Surana & Co., Chartered Accountants';

    const turnoverDoc = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
      fileName: 'CA_Audited_Turnover_FY25.pdf',
      buffer: Buffer.from(turnoverPdfText, 'utf-8'),
      mimeType: 'application/pdf',
      evidenceType: 'AUDITED_BALANCE_SHEET',
    });

    expect(turnoverDoc.verificationStatus).toBe('EXTRACTED');
    expect((turnoverDoc.extractedAttributes as Record<string, unknown>)?.udin).toBe('25089745AAAAAA1234');
    expect((turnoverDoc.extractedAttributes as Record<string, unknown>)?.average_turnover_inr_cr).toBe(281.9);

    // Verify chunks table
    const turnoverChunks = await db
      .select()
      .from(schema.companyEvidenceChunks)
      .where(eq(schema.companyEvidenceChunks.evidenceDocumentId, turnoverDoc.id));

    expect(turnoverChunks.length).toBeGreaterThan(0);
    expect(turnoverChunks[0]?.chunkType).toBe('FINANCIAL_TURNOVER');
    expect(turnoverChunks[0]?.content).toContain('25089745AAAAAA1234');

    // 1B. Upload NHAI Completion Certificate
    const completionPdfText =
      'NATIONAL HIGHWAYS AUTHORITY OF INDIA\n' +
      'PROJECT COMPLETION CERTIFICATE\n' +
      'Name of Work: Construction of 6-Lane Bangalore STRR Highway\n' +
      'Contractor: E2E Infrastructure Developers Private Limited\n' +
      'Completed Contract Value: INR 215.00 Crores\n' +
      'Date of Completion: 30/11/2024';

    const completionDoc = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
      fileName: 'NHAI_STRR_Completion_Certificate.pdf',
      buffer: Buffer.from(completionPdfText, 'utf-8'),
      mimeType: 'application/pdf',
      evidenceType: 'COMPLETION_CERT',
    });

    expect(completionDoc.verificationStatus).toBe('EXTRACTED');
    expect((completionDoc.extractedAttributes as Record<string, unknown>)?.client_name).toBe('NHAI');
    expect((completionDoc.extractedAttributes as Record<string, unknown>)?.contract_value_inr_cr).toBe(215.0);

    const completionChunks = await db
      .select()
      .from(schema.companyEvidenceChunks)
      .where(eq(schema.companyEvidenceChunks.evidenceDocumentId, completionDoc.id));

    expect(completionChunks.length).toBeGreaterThan(0);
    expect(completionChunks[0]?.chunkType).toBe('PROJECT_EXPERIENCE');
    expect(completionChunks[0]?.content).toContain('215');
  });

  it('2. should evaluate qualifying bid end-to-end, producing GO verdict with verified dual-provenance citations', async () => {
    // 2A. Ingest Evidence Documents
    const turnoverDoc = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
      fileName: 'CA_Audited_Turnover_FY25.pdf',
      buffer: Buffer.from('Annual Turnover INR 320.5 Crores, UDIN: 25089745AAAAAA1234', 'utf-8'),
      mimeType: 'application/pdf',
      evidenceType: 'AUDITED_BALANCE_SHEET',
    });

    const completionDoc = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
      fileName: 'NHAI_STRR_Completion_Certificate.pdf',
      buffer: Buffer.from('NHAI Highway Project: Completed Contract Value INR 215.00 Crores', 'utf-8'),
      mimeType: 'application/pdf',
      evidenceType: 'COMPLETION_CERT',
    });

    // 2B. Seed Tender (Bid Project) with qualifying requirements (₹50 Cr turnover, ₹100 Cr estimated value)
    await db.insert(schema.bids).values({
      id: TEST_BID_ID,
      organizationId: TEST_ORG_ID,
      companyId: TEST_COMPANY_ID,
      title: 'NHAI 4-Lane Greenfield Highway Construction',
      tenderNumber: 'NIT-NHAI-2026-001',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValueRupees: 100 * 1e7,
      locationState: 'Karnataka',
      submissionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      status: 'INTAKE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Compliance Items
    await db.insert(schema.complianceItems).values([
      {
        id: 'comp_item_turnover',
        bidId: TEST_BID_ID,
        organizationId: TEST_ORG_ID,
        companyId: TEST_COMPANY_ID,
        category: 'FINANCIAL',
        title: 'Minimum Annual Financial Turnover',
        description: 'Bidder must have average annual turnover of at least INR 50 Crores in the last 3 financial years.',
        status: 'UNREVIEWED',
        provenance: {
          pageNumber: 14,
          clauseReference: 'NIT Clause 4.2',
          verbatimQuote: 'Average annual turnover shall not be less than INR 50.00 Crores.',
          confidenceScore: 0.99,
        },
        executionRules: {
          udinRequired: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'comp_item_experience',
        bidId: TEST_BID_ID,
        organizationId: TEST_ORG_ID,
        companyId: TEST_COMPANY_ID,
        category: 'TECHNICAL',
        title: 'Similar Past Work Experience',
        description: 'Experience in completing similar highway construction contract of value at least INR 70 Crores.',
        status: 'UNREVIEWED',
        executionRules: {},
        provenance: {
          pageNumber: 18,
          clauseReference: 'NIT Clause 4.5',
          verbatimQuote: 'Completed contract value of similar works must exceed INR 70.00 Crores.',
          confidenceScore: 0.97,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // 2C. Run End-to-End Bid/No-Bid Decision
    const verdict = await getBidDecisionUseCase.evaluate(TEST_BID_ID);

    expect(verdict.bidId).toBe(TEST_BID_ID);
    expect(verdict.verdict).toBe('GO');
    expect(verdict.readinessScore).toBeGreaterThanOrEqual(0.85);

    // Verify Reasons to Pursue contain deterministic mathematical validations
    const turnoverReason = verdict.reasonsToPursue.find((r) => r.category === 'FINANCIAL');
    expect(turnoverReason).toBeDefined();
    expect(turnoverReason?.detail).toContain('₹281.90 Cr');
    expect(turnoverReason?.detail).toContain('₹50.00 Cr');

    const expReason = verdict.reasonsToPursue.find((r) => r.category === 'TECHNICAL');
    expect(expReason).toBeDefined();
    expect(expReason?.detail).toContain('₹215.00 Cr');

    // Verify Evidence Citations contain Dual Provenance
    expect(verdict.evidenceCitations.length).toBeGreaterThanOrEqual(2);

    const turnoverCitation = verdict.evidenceCitations.find((c) =>
      /turnover/i.test(String(c.tenderRequirementTitle || '')),
    );
    expect(turnoverCitation).toBeDefined();
    expect(turnoverCitation?.documentName).toBe('CA_Audited_Turnover_FY25.pdf');
    expect(turnoverCitation?.companyEvidenceRef).toBe(turnoverDoc.id);

    const expCitation = verdict.evidenceCitations.find((c) =>
      /experience|similar/i.test(String(c.tenderRequirementTitle || '')),
    );
    expect(expCitation).toBeDefined();
    expect(expCitation?.documentName).toBe('NHAI_STRR_Completion_Certificate.pdf');
    expect(expCitation?.companyEvidenceRef).toBe(completionDoc.id);
  });

  it('3. should enforce deterministic mathematical gating: emit NO_GO when company falls short of hard eligibility threshold', async () => {
    // 3A. Ingest normal evidence (Turnover ₹281.9 Cr)
    await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
      fileName: 'CA_Audited_Turnover_FY25.pdf',
      buffer: Buffer.from('Turnover INR 320.5 Crores, UDIN: 25089745AAAAAA1234', 'utf-8'),
      mimeType: 'application/pdf',
      evidenceType: 'AUDITED_BALANCE_SHEET',
    });

    // 3B. Seed Mega-Project Tender (₹1,500 Cr project, requiring ₹500 Cr turnover)
    const megaBidId = 'bid_mega_expressway_999';
    await db.insert(schema.bids).values({
      id: megaBidId,
      organizationId: TEST_ORG_ID,
      companyId: TEST_COMPANY_ID,
      title: 'Mega Express Corridor Package A',
      tenderNumber: 'NIT-NHAI-2026-MEGA',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValueRupees: 1500 * 1e7,
      locationState: 'Maharashtra',
      submissionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      status: 'INTAKE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.complianceItems).values({
      id: 'comp_item_mega_turnover',
      bidId: megaBidId,
      organizationId: TEST_ORG_ID,
      companyId: TEST_COMPANY_ID,
      category: 'FINANCIAL',
      title: 'Mega-Project Annual Financial Turnover',
      description: 'Minimum average annual turnover of INR 500 Crores required.',
      status: 'UNREVIEWED',
      executionRules: {},
      provenance: {
        pageNumber: 8,
        clauseReference: 'NIT Clause 3.1',
        verbatimQuote: 'Average turnover of INR 500.00 Crores in the last 3 financial years.',
        confidenceScore: 0.99,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3C. Run Bid/No-Bid Decision
    const verdict = await getBidDecisionUseCase.evaluate(megaBidId);

    // Must be NO_GO because 281.9 < 500
    expect(verdict.verdict).toBe('NO_GO');
    expect(verdict.readinessScore).toBeLessThan(0.70);

    const turnoverShortfall = verdict.reasonsNotToPursue.find((r) => r.category === 'FINANCIAL');
    expect(turnoverShortfall).toBeDefined();
    expect(turnoverShortfall?.title).toContain('Turnover');
    expect(turnoverShortfall?.detail).toContain('₹281.90 Cr is below the required ₹500.00 Cr');
  });

  it('4. should strictly prevent cross-tenant access to company evidence and bids (Tenant Isolation)', async () => {
    // 4A. Switch context to foreign organization
    TenantContextHolder.enter({
      organizationId: OTHER_ORG_ID,
      userId: 'usr_foreign_intruder',
      role: 'ADMIN',
    });

    // Attempt to evaluate bid belonging to TEST_ORG_ID
    await expect(getBidDecisionUseCase.evaluate(TEST_BID_ID)).rejects.toThrow(NotFoundError);

    // Verify foreign tenant cannot query TEST_ORG_ID's evidence chunks
    const chunks = await db
      .select()
      .from(schema.companyEvidenceChunks)
      .where(eq(schema.companyEvidenceChunks.organizationId, OTHER_ORG_ID));
    expect(chunks.length).toBe(0);
  });

  it('5. should parse Indian format dates (DD/MM/YYYY, DD-MM-YYYY) and ISO formats safely without Invalid Date', () => {
    // 5A. Indian slash format
    const d1 = parseFlexibleDate('31/03/2026');
    expect(d1).toBeInstanceOf(Date);
    expect(d1?.getUTCFullYear()).toBe(2026);
    expect(d1?.getUTCMonth()).toBe(2); // March is index 2
    expect(d1?.getUTCDate()).toBe(31);

    // 5B. Indian hyphen format
    const d2 = parseFlexibleDate('15-08-2025');
    expect(d2).toBeInstanceOf(Date);
    expect(d2?.getUTCFullYear()).toBe(2025);
    expect(d2?.getUTCMonth()).toBe(7); // August is index 7
    expect(d2?.getUTCDate()).toBe(15);

    // 5C. Indian dot format (e.g. CA certificates, tax audits: 31.03.2024)
    const dDot = parseFlexibleDate('31.03.2024');
    expect(dDot).toBeInstanceOf(Date);
    expect(dDot?.getUTCFullYear()).toBe(2024);
    expect(dDot?.getUTCMonth()).toBe(2); // March is index 2
    expect(dDot?.getUTCDate()).toBe(31);

    // 5D. ISO format
    const d3 = parseFlexibleDate('2026-11-20');
    expect(d3).toBeInstanceOf(Date);
    expect(d3?.getFullYear()).toBe(2026);

    // 5E. Invalid dates (e.g. Feb 31 calendar overflow) / null strings should return null rather than NaN Date or rolled over month
    expect(parseFlexibleDate('31/02/2024')).toBeNull();
    expect(parseFlexibleDate('invalid-date-string')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate(null)).toBeNull();
    expect(parseFlexibleDate(undefined)).toBeNull();
  });

  it('6. should provide safe fallback defaults in RequirementMapper for manual requirements without full provenance', () => {
    const candidate = toRequirementCandidate({
      category: 'FINANCIAL',
      title: 'Manual Financial Covenant',
      description: 'Minimum turnover requirement entered manually.',
      executionRules: null,
      provenance: {}, // empty provenance from manual entry
    });

    expect(candidate.provenance.source_document_id).toBe('doc-general');
    expect(candidate.provenance.source_file_name).toBe('NIT_Document.pdf');
    expect(candidate.provenance.clause_reference).toBe('Clause Reference');
    expect(candidate.provenance.page_number).toBe(1);
    expect(candidate.provenance.verbatim_quote.length).toBeGreaterThan(0);
  });

  it('7. should emit REVIEW_REQUIRED verdict in AiDecisionClient fallback when ambiguities or zero-confidence items exist', async () => {
    const client = new AiDecisionClient();

    const request: AiBidDecisionRequest = {
      security_context: {
        tenant_id: TEST_ORG_ID,
        user_id: 'usr_01',
        workflow_run_id: 'run-review-test',
        allowed_document_ids: [],
        purpose: 'BID_DECISION',
      },
      tender_id: 'tnd_ambiguous_01',
      tender_title: 'Ambiguous Tender Project',
      estimated_value_inr_crores: 50.0,
      submission_deadline: '2026-12-31',
      project_location_state: 'Karnataka',
      requirements: [
        {
          category: 'FINANCIAL',
          kind: 'ELIGIBILITY_THRESHOLD',
          criticality: 'HARD_ELIGIBILITY',
          title: 'Financial Turnover Requirement',
          description: 'Adequate turnover required.',
          criterion: { type: 'TURNOVER', threshold: 10.0, operator: 'GTE' },
          execution_rules: {
            stamp_paper_required: false,
            stamp_paper_denomination_inr: null,
            notarization_required: false,
            signing_authority_rank: 'Director',
            udin_required: false,
          },
          provenance: {
            source_document_id: 'doc-1',
            source_file_name: 'NIT.pdf',
            page_number: 1,
            clause_reference: 'Clause 2.1',
            verbatim_quote: 'Adequate turnover required.',
            confidence_score: 0.0, // Zero confidence score!
          },
          ambiguity_flags: [
            {
              type: 'VAGUE_QUANTIFIER',
              detail: "Unclear meaning of 'adequate turnover'",
              quote: 'adequate turnover',
            },
          ],
        },
      ],
      company_profile: {
        company_id: TEST_COMPANY_ID,
        company_name: 'Test Co',
        profile_version_id: 'v1',
        is_active: true,
        turnover_records: [
          {
            financial_year: 'FY24',
            turnover_inr_crores: 50.0,
            evidence_document_id: 'ev-1',
          },
        ],
        experience: [
          {
            contract_value_inr_crores: 30.0,
            evidence_document_id: 'ev-2',
          },
        ],
        operating_regions: ['Karnataka'],
      },
      require_human_review: true,
    };

    const response = await client.evaluate(request);

    // Must emit REVIEW_REQUIRED due to ambiguity flags and zero confidence
    expect(response.verdict).toBe('REVIEW_REQUIRED');
    expect(response.state).toBe('UNDER_REVIEW');
    expect(response.review_triggers.length).toBeGreaterThanOrEqual(1);
  });
});
