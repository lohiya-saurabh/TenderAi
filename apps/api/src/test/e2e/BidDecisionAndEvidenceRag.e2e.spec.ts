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
    // The AI worker's answers, as it would return them for these two documents.
    evidenceExtractor = new AiEvidenceExtractor({
      customFetch: (async (_url: string, init: RequestInit) => {
        const req = JSON.parse(String(init.body)) as {
          evidence_document_id: string;
          organization_id: string;
          company_id: string;
          file_name: string;
          pages: { text: string }[];
        };
        const text = req.pages[0]?.text ?? '';
        const turnover = req.file_name.includes('Turnover');
        const body = {
          evidence_document_id: req.evidence_document_id,
          organization_id: req.organization_id,
          company_id: req.company_id,
          status: 'COMPLETED',
          extracted_attributes: turnover
            ? { udin: '25089745AAAAAA1234', average_turnover_inr_cr: 281.9 }
            : { client_name: 'NHAI', contract_value_inr_cr: 215.0 },
          chunks: [
            {
              chunk_index: 0,
              chunk_type: turnover ? 'FINANCIAL_TURNOVER' : 'PROJECT_EXPERIENCE',
              content: text,
              page_number: 1,
            },
          ],
        };
        return { ok: true, status: 200, json: async () => body } as Response;
      }) as unknown as typeof fetch,
    });
    evidenceService = new CompanyEvidenceService(
      db,
      storageService,
      undefined,
      undefined,
      undefined,
      evidenceExtractor,
    );

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
    expect((turnoverDoc.extractedAttributes as Record<string, unknown>)?.udin).toBe(
      '25089745AAAAAA1234',
    );
    expect(
      (turnoverDoc.extractedAttributes as Record<string, unknown>)?.average_turnover_inr_cr,
    ).toBe(281.9);

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
    expect((completionDoc.extractedAttributes as Record<string, unknown>)?.client_name).toBe(
      'NHAI',
    );
    expect(
      (completionDoc.extractedAttributes as Record<string, unknown>)?.contract_value_inr_cr,
    ).toBe(215.0);

    const completionChunks = await db
      .select()
      .from(schema.companyEvidenceChunks)
      .where(eq(schema.companyEvidenceChunks.evidenceDocumentId, completionDoc.id));

    expect(completionChunks.length).toBeGreaterThan(0);
    expect(completionChunks[0]?.chunkType).toBe('PROJECT_EXPERIENCE');
    expect(completionChunks[0]?.content).toContain('215');
  });

  it('2. reports an unreachable bid-decision engine instead of answering locally', async () => {
    const client = new AiDecisionClient({
      customFetch: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    await expect(client.evaluate({} as AiBidDecisionRequest)).rejects.toMatchObject({
      statusCode: 503,
    });
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
});
