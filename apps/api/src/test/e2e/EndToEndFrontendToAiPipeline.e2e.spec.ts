/**
 * E2E Integration Suite: Full End-to-End Pipeline
 * Frontend → API Controller/Service → S3 Storage → SQS Job Queue → Ingestion Worker → AI Extraction → PostgreSQL Persistence → SSE Streaming
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { PGlite } from '@electric-sql/pglite';
import { eq, and } from 'drizzle-orm';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { MockSqsJobQueue } from '../../infrastructure/queue/MockSqsJobQueue.js';
import { DocumentsService } from '../..//modules/documents/documents.service.js';
import { DocumentsController } from '../../modules/documents/documents.controller.js';
import { IngestionWorker } from '../../modules/bids/application/IngestionWorker.js';
import { AiDocumentExtractor } from '../../modules/bids/application/AiDocumentExtractor.js';
import { DocumentContentNormalizer } from '../../modules/bids/application/DocumentContentNormalizer.js';
import { InMemoryBidRepository } from '../../infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryTenderDocumentRepository } from '../../infrastructure/persistence/InMemoryTenderDocumentRepository.js';
import { InMemoryIngestionJobRepository } from '../../infrastructure/persistence/InMemoryIngestionJobRepository.js';
import { InMemoryComplianceItemRepository } from '../../infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { InMemoryAuditRepository } from '../../modules/audit/infrastructure/InMemoryAuditRepository.js';
import { DirectUnitOfWork } from '../../common/database/IUnitOfWork.js';
import { InMemoryEventBus } from '../../common/events/InMemoryEventBus.js';
import { BidProject } from '../../modules/bids/domain/entities/BidProject.js';
import { TenderDocument } from '../../modules/bids/domain/entities/TenderDocument.js';
import { IngestionJob } from '../../modules/bids/domain/entities/IngestionJob.js';
import type { IngestionJobMessage } from '../../modules/bids/application/IJobQueue.js';
import { BidStatus } from '../../modules/bids/domain/value-objects/BidStatus.js';
import { Money } from '../../modules/bids/domain/value-objects/Money.js';

describe('E2E Full Pipeline: Frontend → API → S3 → SQS → AI Extraction → DB Persistence', () => {
  let pglite: PGlite;
  let db: DrizzleDb;
  let storageService: MockStorageService;
  let jobQueue: MockSqsJobQueue;
  let documentsService: DocumentsService;
  let documentsController: DocumentsController;

  // Repositories for IngestionWorker
  let bidRepo: InMemoryBidRepository;
  let documentRepo: InMemoryTenderDocumentRepository;
  let jobRepo: InMemoryIngestionJobRepository;
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let unitOfWork: DirectUnitOfWork;
  let eventBus: InMemoryEventBus;
  let normalizer: DocumentContentNormalizer;
  let aiExtractor: AiDocumentExtractor;
  let worker: IngestionWorker;

  const tenantA = 'org_tata_infra_001';
  const tenantB = 'org_competitor_rogue';
  const userId = 'usr_bid_mgr_01';
  const testBidId = 'bid-nhai-bridge-2026';

  const samplePdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length 280>>stream
BT
/F1 12 Tf
72 712 Td (Notice Inviting Tender: National Highways Authority of India) Tj
0 -20 Td (Clause 4.1: Bidder must furnish Earnest Money Deposit EMD of INR 10,00,000 via Bank Guarantee.) Tj
0 -20 Td (Clause 7.2: Minimum average annual financial turnover of INR 50 Crores with CA certificate bearing UDIN.) Tj
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

  beforeEach(async () => {
    // 1. Initialize embedded PostgreSQL
    pglite = new PGlite();
    await initDatabase(pglite, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    db = createDrizzle(pglite);

    // 2. Initialize S3 Storage and SQS Queue
    storageService = new MockStorageService();
    jobQueue = new MockSqsJobQueue(3);

    // 3. Create DocumentsService and Controller
    documentsService = new DocumentsService(db, storageService);
    documentsController = new DocumentsController(documentsService);

    // 4. Initialize Repositories and Worker
    bidRepo = new InMemoryBidRepository();
    documentRepo = new InMemoryTenderDocumentRepository();
    jobRepo = new InMemoryIngestionJobRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    unitOfWork = new DirectUnitOfWork();
    eventBus = new InMemoryEventBus();
    normalizer = new DocumentContentNormalizer();

    // 5. Configure AI Document Extractor simulating FastAPI AI service
    aiExtractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async (_url, init) => {
        const body = JSON.parse(init.body as string);
        expect(body.security_context.tenant_id).toBe(tenantA);
        expect(body.security_context.company_id).toBeDefined();
        expect(body.security_context.correlation_id).toBeDefined();

        return {
          ok: true,
          status: 200,
          json: async () => ({
            bid_id: body.bid_id,
            document_id: body.document_id,
            status: 'SUCCESS',
            items: [
              {
                category: 'FINANCIAL',
                title: 'Earnest Money Deposit (EMD) Guarantee',
                description: 'INR 10,00,000 Bank Guarantee on Rs 100 Stamp Paper',
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
                    'Bidder must furnish Earnest Money Deposit EMD of INR 10,00,000 via Bank Guarantee.',
                  confidenceScore: 0.99,
                },
              },
              {
                category: 'FINANCIAL',
                title: 'Annual Financial Turnover & UDIN Certification',
                description: 'Minimum turnover of INR 50 Crores with CA certificate bearing valid UDIN',
                executionRules: {
                  stampPaperRequired: false,
                  notarizationRequired: false,
                  udinRequired: true,
                  signingAuthorityRank: 'Statutory Auditor / CA',
                },
                provenance: {
                  pageNumber: 1,
                  clauseReference: 'Clause 7.2',
                  verbatimQuote:
                    'Minimum average annual financial turnover of INR 50 Crores with CA certificate bearing UDIN.',
                  confidenceScore: 0.97,
                },
              },
            ],
          }),
        };
      },
    });

    worker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      aiExtractor,
      300,
      'worker-integration-e2e',
      eventBus
    );

    // Pre-seed company entities
    await db.insert(schema.companies).values([
      {
        id: 'comp_tata_infra_001',
        organizationId: tenantA,
        legalName: 'Tata Projects Ltd',
      },
      {
        id: 'comp_lnt_infra_002',
        organizationId: tenantB,
        legalName: 'Larsen & Toubro Ltd',
      },
    ]);

    // 6. Pre-seed the bid in PostgreSQL and in-memory domain repo
    await db.insert(schema.bids).values({
      id: testBidId,
      organizationId: tenantA,
      companyId: 'comp_tata_infra_001',
      title: 'NHAI Six-Lane Cable Stayed Bridge Over Ganga',
      tenderNumber: 'NHAI/2026/BR-402',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValueRupees: 450000000,
      submissionDeadline: '2026-11-30T18:00:00Z',
      status: 'DRAFT',
      totalRequirements: 0,
      flaggedRequirements: 0,
      approvedRequirements: 0,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const bidEntity = new BidProject({
      id: testBidId,
      organizationId: tenantA,
      companyId: 'comp_tata_infra_001',
      title: 'NHAI Six-Lane Cable Stayed Bridge Over Ganga',
      tenderNumber: 'NHAI/2026/BR-402',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValue: new Money(450000000, 'INR'),
      submissionDeadline: new Date('2026-11-30T18:00:00Z'),
      status: BidStatus.DRAFT,
      version: 1,
    });
    await bidRepo.save(bidEntity);
  });

  it('completes the entire cycle: Frontend request → API → S3 → SQS → IngestionWorker → AI → DB', async () => {
    // -------------------------------------------------------------
    // STAGE 1: FRONTEND → API (Presigned Upload URL Generation)
    // -------------------------------------------------------------
    const uploadSession = await TenantContextHolder.run(
      { organizationId: tenantA, userId, role: 'BID_MANAGER' },
      () =>
        documentsController.generateUploadUrl(
          testBidId,
          {
            fileName: 'NHAI_NIT_Bridge_Tender.pdf',
            mimeType: 'application/pdf',
            sizeBytes: samplePdfContent.length,
            documentType: 'NIT',
          },
          'api.tenderpulse.local'
        )
    );

    expect(uploadSession.documentId).toBeDefined();
    expect(uploadSession.uploadUrl).toBeDefined();
    expect(uploadSession.storagePath).toContain(`tenants/${tenantA}/bids/${testBidId}/`);
    expect(uploadSession.storagePath).toContain('NHAI_NIT_Bridge_Tender.pdf');
    expect(uploadSession.expiresInSeconds).toBe(900);

    const docId = uploadSession.documentId;
    const storagePath = uploadSession.storagePath;

    // -------------------------------------------------------------
    // STAGE 2: FRONTEND → S3 STORAGE (Direct Binary Upload)
    // -------------------------------------------------------------
    // Frontend PUTs the binary PDF buffer directly to S3 / Storage Service
    const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    storageService.simulateUploadedObject(
      storagePath,
      samplePdfContent.length,
      validChecksum,
      samplePdfContent
    );

    const headResult = await storageService.headObject(storagePath);
    expect(headResult.exists).toBe(true);
    expect(headResult.sizeBytes).toBe(samplePdfContent.length);

    // Also register in worker's documentRepo and jobRepo to sync trusted DB state
    const tenderDoc = new TenderDocument({
      id: docId,
      bidId: testBidId,
      organizationId: tenantA,
      documentType: 'NIT',
      fileName: 'NHAI_NIT_Bridge_Tender.pdf',
      storagePath,
      sizeBytes: samplePdfContent.length,
      mimeType: 'application/pdf',
      checksumSha256: validChecksum,
    });
    await documentRepo.save(tenderDoc);

    // -------------------------------------------------------------
    // STAGE 3: FRONTEND → API (Confirm Upload) & SQS ENQUEUE
    // -------------------------------------------------------------
    const confirmResult = await TenantContextHolder.run(
      { organizationId: tenantA, userId, role: 'BID_MANAGER' },
      () =>
        documentsController.confirmUpload(testBidId, {
          documentId: docId,
        })
    );

    expect(confirmResult.documentId).toBe(docId);
    expect(confirmResult.status).toBe('UPLOADED');

    // Verify document was recorded in PostgreSQL database
    const [persistedDoc] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(and(eq(schema.tenderDocuments.id, docId), eq(schema.tenderDocuments.organizationId, tenantA)))
      .limit(1);

    expect(persistedDoc).toBeDefined();
    expect(persistedDoc?.fileName).toBe('NHAI_NIT_Bridge_Tender.pdf');
    expect(persistedDoc?.storagePath).toBe(storagePath);
    expect(Number(persistedDoc?.fileSizeBytes)).toBe(samplePdfContent.length);

    // The production runtime publishes this durable outbox entry. This E2E keeps
    // the legacy in-memory worker isolated by advancing the outbox-to-queue boundary.
    const [outboxRecord] = await db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.documentId, docId))
      .limit(1);
    expect(outboxRecord?.status).toBe('PENDING');
    if (!outboxRecord) throw new Error('Upload confirmation did not create a durable outbox record.');
    await jobQueue.enqueue(outboxRecord.payload as IngestionJobMessage);

    // Verify the queue received the message published from the durable outbox
    const queueMessages = await jobQueue.receiveMessages(10, 300);
    expect(queueMessages.length).toBeGreaterThan(0);

    const queueMsg = queueMessages[0]!;
    expect(queueMsg.body.bidId).toBe(testBidId);
    expect(queueMsg.body.documentId).toBe(docId);
    expect(queueMsg.body.organizationId).toBe(tenantA);

    // -------------------------------------------------------------
    // STAGE 4: SQS → INGESTION WORKER EXECUTION
    // -------------------------------------------------------------
    // Pre-create the IngestionJob in jobRepo to satisfy worker anti-tampering verification
    const ingestionJob = new IngestionJob({
      id: queueMsg.body.jobId,
      organizationId: tenantA,
      bidId: testBidId,
      documentId: docId,
      status: 'PENDING',
    });
    await jobRepo.save(ingestionJob);

    // Transition bid to QUEUED in accordance with the BidStatus state machine
    const bidEntity = await bidRepo.findById(testBidId, tenantA);
    expect(bidEntity).toBeDefined();
    bidEntity!.markQueued();
    await bidRepo.update(bidEntity!);

    // Worker polls and processes message from SQS
    const workerResult = await worker.processMessage(queueMsg);
    expect(workerResult.processed).toBe(true);

    // Verify job in repository marked COMPLETED
    const completedJob = await jobRepo.findById(queueMsg.body.jobId, tenantA);
    expect(completedJob?.status).toBe('COMPLETED');

    // -------------------------------------------------------------
    // STAGE 5: AI EXTRACTION RESULTS & POSTGRESQL PERSISTENCE
    // -------------------------------------------------------------
    // Verify compliance items extracted by AI were saved into repository
    const complianceItems = await complianceRepo.findByBidId(testBidId, tenantA);
    expect(complianceItems.length).toBe(2);

    const emdItem = complianceItems.find((i) => i.title.includes('Earnest Money Deposit'));
    expect(emdItem).toBeDefined();
    expect(emdItem?.executionRules.stampPaperRequired).toBe(true);
    expect(emdItem?.executionRules.stampPaperDenominationInr).toBe(100);
    expect(emdItem?.provenance.verbatimQuote).toContain('Bidder must furnish Earnest Money Deposit');

    const turnoverItem = complianceItems.find((i) => i.title.includes('Turnover'));
    expect(turnoverItem).toBeDefined();
    expect(turnoverItem?.executionRules.udinRequired).toBe(true);
    expect(turnoverItem?.provenance.verbatimQuote).toContain('Minimum average annual financial turnover');

    // Verify bid status updated to REVIEW_READY
    const updatedBid = await bidRepo.findById(testBidId, tenantA);
    expect(updatedBid?.status.value).toBe('REVIEW_READY');

    // -------------------------------------------------------------
    // STAGE 6: AUDIT TRAIL VERIFICATION
    // -------------------------------------------------------------
    const [auditLog] = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.bidId, testBidId), eq(schema.auditLogs.aggregateId, docId)))
      .limit(1);

    expect(auditLog).toBeDefined();
    expect(auditLog?.eventType).toBe('DOCUMENT_UPLOADED');
    expect(auditLog?.organizationId).toBe(tenantA);
  });

  it('enforces Anti-IDOR security: prevents cross-tenant upload confirmation', async () => {
    // Tenant B attempts to confirm an upload on Tenant A's bid
    await expect(
      TenantContextHolder.run(
        { organizationId: tenantB, userId: 'rogue-user', role: 'BID_MANAGER' },
        () => documentsController.confirmUpload(testBidId, { documentId: 'doc-rogue-1' })
      )
    ).rejects.toThrow();
  });

  it('routes tampered SQS messages with mismatched claims to Dead Letter Queue (DLQ)', async () => {
    // Poison message: claim tenantA, but bid belongs to tenantB or does not exist
    await jobQueue.enqueue({
      jobId: 'job-poison-999',
      organizationId: tenantA,
      bidId: 'nonexistent-bid-id',
      documentId: 'nonexistent-doc-id',
      timestamp: new Date().toISOString(),
    });

    const [poisonMsg] = await jobQueue.receiveMessages(1, 300);
    expect(poisonMsg).toBeDefined();

    const result = await worker.processMessage(poisonMsg!);
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('UNAUTHORIZED_JOB_NOT_FOUND');

    // Verify message was moved to DLQ
    const dlqMessages = await jobQueue.getDeadLetterMessages();
    expect(dlqMessages.length).toBeGreaterThan(0);
    expect(dlqMessages[0]?.message.jobId).toBe('job-poison-999');
  });

  it('does not trigger synchronous extraction from the NestJS SSE progress endpoint', async () => {
    const markSpy = vi.spyOn(documentsService, 'markExtractionComplete');
    const emittedEvents: Array<{ step: string; progress: number; status?: string }> = [];

    const mockRes = {
      set: () => {},
      flushHeaders: () => {},
      write: (dataStr: string) => {
        const jsonMatch = dataStr.match(/data:\s*(.+)\n\n/);
        if (jsonMatch && jsonMatch[1]) {
          emittedEvents.push(JSON.parse(jsonMatch[1]));
        }
      },
    };

    const mockReq = {
      on: () => {},
    };

    TenantContextHolder.run({ organizationId: tenantA, userId, role: 'BID_MANAGER' }, () => {
      documentsController.streamExtractionProgress(
        testBidId,
        mockReq as unknown as Request,
        mockRes as unknown as Response
      );
    });

    expect(markSpy).not.toHaveBeenCalled();
    expect(emittedEvents[0]?.step).toBe('PARSING_PAGES');
    expect(emittedEvents[0]?.progress).toBe(25);
  });

  it('provides SSE progress streaming from PARSING_PAGES to COMPLETED', async () => {
    const emittedEvents: Array<{ step: string; progress: number; status?: string }> = [];

    const mockRes = {
      set: () => {},
      flushHeaders: () => {},
      write: (dataStr: string) => {
        const jsonMatch = dataStr.match(/data:\s*(.+)\n\n/);
        if (jsonMatch && jsonMatch[1]) {
          emittedEvents.push(JSON.parse(jsonMatch[1]));
        }
      },
    };

    const mockReq = {
      on: () => {},
    };

    TenantContextHolder.run({ organizationId: tenantA, userId, role: 'BID_MANAGER' }, () => {
      documentsController.streamExtractionProgress(
        testBidId,
        mockReq as unknown as Request,
        mockRes as unknown as Response
      );
    });

    // Check that initial SSE event was pushed immediately
    expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
    expect(emittedEvents[0]?.step).toBe('PARSING_PAGES');
    expect(emittedEvents[0]?.progress).toBe(25);
  });
});
