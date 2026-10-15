import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module.js';
import { DocumentProcessingRuntime } from '@/modules/documents/DocumentProcessingRuntime.js';
import { DRIZZLE_TOKEN, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { eq } from 'drizzle-orm';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';
import type { IngestionJobMessage } from '@/modules/bids/application/IJobQueue.js';

describe('E2E Live HTTP API Verification: Two-Queue Option B Pipeline', () => {
  let app: INestApplication;
  let baseUrl: string;
  let db: DrizzleDb;
  let runtime: DocumentProcessingRuntime;
  let authToken: string;

  const validSamplePdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length 320>>stream
BT
/F1 12 Tf
72 712 Td (Notice Inviting Tender: National Highways Authority of India NHAI) Tj
0 -20 Td (Tender Number: NHAI/2026/HW-EPC-88) Tj
0 -20 Td (Clause 4.1: Bidder must furnish Earnest Money Deposit EMD of INR 25,00,000 via Bank Guarantee.) Tj
0 -20 Td (Clause 7.2: Minimum average annual turnover of INR 100 Crores with CA certificate bearing UDIN.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000178 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
512
%%EOF`;

  beforeAll(async () => {
    // 1. Boot full NestJS Application with actual AppModule
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter.js');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.listen(0);

    baseUrl = await app.getUrl();
    db = app.get<DrizzleDb>(DRIZZLE_TOKEN);
    runtime = app.get<DocumentProcessingRuntime>(DocumentProcessingRuntime);

    // Seed test organization, company, and user
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    await db
      .insert(schema.companies)
      .values({
        id: 'comp_acme_infra_001',
        organizationId: 'org_acme_infra_001',
        legalName: 'Acme Infrastructure Pvt Ltd',
      })
      .onConflictDoNothing();

    await db
      .insert(schema.users)
      .values({
        id: 'usr_bid_mgr_01',
        email: 'bidmanager@acme.com',
        password: hashedPassword,
        name: 'Priya Sharma',
        role: 'BID_MANAGER',
        permissions: [
          'bids:create',
          'bids:read',
          'bids:update',
          'bids:delete',
          'documents:upload',
          'documents:read',
          'compliance:review',
        ],
        organizationId: 'org_acme_infra_001',
        organizationName: 'Acme Infrastructure Ltd',
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { password: hashedPassword },
      });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('executes full end-to-end API lifecycle across HTTP, transactional outbox, and decoupled queues', async () => {
    // =========================================================================
    // STEP 1: Authenticate via real HTTP POST /api/v1/auth/login
    // =========================================================================
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bidmanager@acme.com',
        password: 'Password123!',
      }),
    });

    expect(loginRes.status).toBe(201);
    const loginData = (await loginRes.json()) as {
      accessToken: string;
      user: { id: string; organizationId: string };
    };
    expect(loginData.accessToken).toBeDefined();
    expect(loginData.user.organizationId).toBe('org_acme_infra_001');
    authToken = loginData.accessToken;

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    // =========================================================================
    // STEP 2: Create a Tender Bid via real HTTP POST /api/v1/bids
    // =========================================================================
    const createBidRes = await fetch(`${baseUrl}/api/v1/bids`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'National Highways Authority of India NHAI Highway Expansion',
        tenderNumber: 'NHAI/2026/HW-EPC-88',
        tenderingAuthority: 'NHAI',
        estimatedValueRupees: 250000000,
        submissionDeadline: '2026-12-31T23:59:59.000Z',
        locationState: 'Maharashtra',
      }),
    });

    expect(createBidRes.status).toBe(201);
    const createdBid = (await createBidRes.json()) as { bidId: string; status: string };
    expect(createdBid.bidId).toBeDefined();
    const bidId = createdBid.bidId;

    // =========================================================================
    // STEP 3: Request Presigned Upload URL via real HTTP POST /api/v1/bids/:id/upload-url
    // =========================================================================
    const uploadUrlRes = await fetch(`${baseUrl}/api/v1/bids/${bidId}/upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        fileName: 'NHAI_Tender_Notice.pdf',
        documentType: 'NIT',
        mimeType: 'application/pdf',
      }),
    });

    expect(uploadUrlRes.status).toBe(201);
    const uploadUrlData = (await uploadUrlRes.json()) as {
      documentId: string;
      uploadUrl: string;
      storagePath: string;
    };
    expect(uploadUrlData.documentId).toBeDefined();
    expect(uploadUrlData.storagePath).toContain(bidId);
    const { documentId } = uploadUrlData;

    // =========================================================================
    // STEP 4: Upload raw PDF bytes via real HTTP PUT to storage/mock upload endpoint
    // =========================================================================
    const mockUploadUrl = `${baseUrl}/api/v1/mock-upload/${bidId}/${documentId}/NHAI_Tender_Notice.pdf`;
    const putRes = await fetch(mockUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: validSamplePdf,
    });
    expect(putRes.status).toBe(200);

    // =========================================================================
    // STEP 5: Confirm Upload via real HTTP POST /api/v1/bids/:id/documents/confirm
    // =========================================================================
    const confirmRes = await fetch(`${baseUrl}/api/v1/bids/${bidId}/documents/confirm`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ documentId }),
    });

    expect(confirmRes.status).toBe(201);
    const confirmData = (await confirmRes.json()) as { documentId: string; status: string };
    expect(confirmData.status).toBe('UPLOADED');

    // =========================================================================
    // STEP 6: Verify Database State (Transactional Outbox created atomically)
    // =========================================================================
    const [dbDoc] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, documentId));
    expect(dbDoc).toBeDefined();
    expect(dbDoc?.status).toBe('QUEUED_FOR_EXTRACTION');

    const [dbBid] = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId));
    expect(dbBid?.status).toBe('QUEUED');

    const [outboxRow] = await db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.documentId, documentId));
    expect(outboxRow).toBeDefined();
    expect(outboxRow?.status).toBe('PENDING');

    // =========================================================================
    // STEP 7: Outbox Poller runs -> Enqueues to Ingestion Queue -> Transitions to PUBLISHED
    // =========================================================================
    await runtime.publishPendingOutboxMessages();

    const [publishedOutbox] = await db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.documentId, documentId));
    expect(publishedOutbox?.status).toBe('PUBLISHED');

    // =========================================================================
    // STEP 8: Verify Ingestion Queue received message AND NestJS did NOT consume it
    // =========================================================================
    // The message is waiting on the Ingestion Queue for the Python AI worker
    const ingestionMessages = await runtime.ingestionQueue.receiveMessages(1, 300);
    expect(ingestionMessages.length).toBe(1);
    const ingestionMsg = ingestionMessages[0]!;
    expect(ingestionMsg.body.documentId).toBe(documentId);
    expect(ingestionMsg.body.bidId).toBe(bidId);
    expect(ingestionMsg.body.organizationId).toBe('org_acme_infra_001');

    // =========================================================================
    // STEP 9: Python AI Worker Execution Simulation:
    //         Consumes from Ingestion Queue -> Extracts -> Publishes to Completion Queue -> Acks Ingestion
    // =========================================================================
    const extractionCompletedEvent: DocumentExtractionCompletedEvent = {
      jobId: ingestionMsg.body.jobId,
      bidId,
      documentId,
      organizationId: 'org_acme_infra_001',
      companyId: ingestionMsg.body.companyId,
      status: 'COMPLETED',
      items: [
        {
          title: 'Earnest Money Deposit (EMD)',
          category: 'FINANCIAL',
          description:
            'Bidder must furnish Earnest Money Deposit EMD of INR 25,00,000 via Bank Guarantee.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: true,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: 1,
            clauseReference: 'Clause 4.1',
            verbatimQuote:
              'Clause 4.1: Bidder must furnish Earnest Money Deposit EMD of INR 25,00,000 via Bank Guarantee.',
            confidenceScore: 0.98,
          },
        },
        {
          title: 'Financial Turnover Covenant',
          category: 'TECHNICAL',
          description:
            'Minimum average annual turnover of INR 100 Crores with CA certificate bearing UDIN.',
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: true,
            signingAuthorityRank: 'Chartered Accountant',
          },
          provenance: {
            pageNumber: 1,
            clauseReference: 'Clause 7.2',
            verbatimQuote:
              'Clause 7.2: Minimum average annual turnover of INR 100 Crores with CA certificate bearing UDIN.',
            confidenceScore: 0.95,
          },
        },
      ],
    };

    // Python worker publishes to Completion Queue
    await runtime.completionQueue.enqueue(
      extractionCompletedEvent as unknown as IngestionJobMessage,
    );

    // Python worker acknowledges (deletes) from Ingestion Queue ONLY after verified publication
    await runtime.ingestionQueue.deleteMessage(ingestionMsg.receiptHandle);

    // Ingestion Queue is now empty
    const remainingIngestion = await runtime.ingestionQueue.receiveMessages(1);
    expect(remainingIngestion.length).toBe(0);

    // =========================================================================
    // STEP 10: NestJS Completion Poller: Consumes Completion Event -> Atomically Persists
    // =========================================================================
    const completionMessages = await runtime.completionQueue.receiveMessages(1, 300);
    expect(completionMessages.length).toBe(1);
    const completionMsg = completionMessages[0]!;

    await runtime.processCompletionMessage(completionMsg);

    // Completion Queue message is acknowledged and deleted
    const remainingCompletion = await runtime.completionQueue.receiveMessages(1);
    expect(remainingCompletion.length).toBe(0);

    // Verify DB Document status transitioned to COMPLETED
    const [completedDoc] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, documentId));
    expect(completedDoc?.status).toBe('COMPLETED');

    // =========================================================================
    // STEP 11: Real HTTP GET /api/v1/bids/:id/compliance-items
    // =========================================================================
    const complianceRes = await fetch(`${baseUrl}/api/v1/bids/${bidId}/compliance-items`, {
      method: 'GET',
      headers: authHeaders,
    });

    expect(complianceRes.status).toBe(200);
    const complianceItems = (await complianceRes.json()) as Array<{
      title: string;
      category: string;
      provenance: { clauseReference: string; verbatimQuote: string };
    }>;

    expect(complianceItems.length).toBe(2);
    const emdItem = complianceItems.find((i) => i.title === 'Earnest Money Deposit (EMD)');
    expect(emdItem).toBeDefined();
    expect(emdItem?.provenance.clauseReference).toBe('Clause 4.1');
    expect(emdItem?.provenance.verbatimQuote).toContain('INR 25,00,000');

    const turnoverItem = complianceItems.find((i) => i.title === 'Financial Turnover Covenant');
    expect(turnoverItem).toBeDefined();
    expect(turnoverItem?.provenance.clauseReference).toBe('Clause 7.2');
    expect(turnoverItem?.provenance.verbatimQuote).toContain('UDIN');

    // =========================================================================
    // STEP 12: Real HTTP GET /api/v1/bids/:id (Bid detail reflects progress)
    // =========================================================================
    const getBidRes = await fetch(`${baseUrl}/api/v1/bids/${bidId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    expect(getBidRes.status).toBe(200);
    const bidDetail = (await getBidRes.json()) as {
      id: string;
      title: string;
      tenderNumber: string;
      status: string;
      totalRequirements: number;
    };
    expect(bidDetail.id).toBe(bidId);
    expect(bidDetail.tenderNumber).toBe('NHAI/2026/HW-EPC-88');
    expect(bidDetail.totalRequirements).toBe(2);

    // =========================================================================
    // STEP 13: Security & Zero-Trust Verification: Unauthenticated HTTP request blocked
    // =========================================================================
    const unauthRes = await fetch(`${baseUrl}/api/v1/bids/${bidId}/compliance-items`, {
      method: 'GET',
    });
    // Request without Authorization header must be rejected
    expect(unauthRes.status).toBe(401);
  });
});
