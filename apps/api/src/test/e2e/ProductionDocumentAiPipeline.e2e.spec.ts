import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '../../common/database/IUnitOfWork.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { InMemoryAuditRepository } from '../../modules/audit/infrastructure/InMemoryAuditRepository.js';
import { CreateBidUseCase } from '../../modules/bids/application/CreateBidUseCase.js';
import { GenerateUploadUrlUseCase } from '../../modules/bids/application/GenerateUploadUrlUseCase.js';
import { ConfirmDocumentUploadUseCase } from '../../modules/bids/application/ConfirmDocumentUploadUseCase.js';
import { IngestionWorker } from '../../modules/bids/application/IngestionWorker.js';
import { AiDocumentExtractor } from '../../modules/bids/application/AiDocumentExtractor.js';
import { DocumentContentNormalizer } from '../../modules/bids/application/DocumentContentNormalizer.js';
import { InMemoryBidRepository } from '../../infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryTenderDocumentRepository } from '../../infrastructure/persistence/InMemoryTenderDocumentRepository.js';
import { InMemoryIngestionJobRepository } from '../../infrastructure/persistence/InMemoryIngestionJobRepository.js';
import { InMemoryComplianceItemRepository } from '../../infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { MockSqsJobQueue } from '../../infrastructure/queue/MockSqsJobQueue.js';
import { IngestionJob } from '../../modules/bids/domain/entities/IngestionJob.js';
import { InMemoryEventBus } from '../../common/events/InMemoryEventBus.js';
import { ComplianceIngestionCompletedEvent } from '../../modules/bids/domain/events/ComplianceIngestionCompletedEvent.js';

describe('E2E: Production Document + AI Pipeline (S3 → SQS → Extraction Worker → Normalized Content → AI Workflow → Deterministic Validation → PostgreSQL → Notification/Review)', () => {
  let bidRepo: InMemoryBidRepository;
  let documentRepo: InMemoryTenderDocumentRepository;
  let jobRepo: InMemoryIngestionJobRepository;
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let storageService: MockStorageService;
  let jobQueue: MockSqsJobQueue;
  let unitOfWork: DirectUnitOfWork;
  let eventBus: InMemoryEventBus;
  let normalizer: DocumentContentNormalizer;

  let createBidUseCase: CreateBidUseCase;
  let generateUploadUrlUseCase: GenerateUploadUrlUseCase;
  let confirmUploadUseCase: ConfirmDocumentUploadUseCase;
  let aiExtractor: AiDocumentExtractor;
  let worker: IngestionWorker;

  const tenantA = 'org-tata-projects-infra';
  const tenantB = 'org-competitor-rogue';
  const bidManagerUser = 'usr-bid-manager-77';
  const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const simulatedTenderText = `--- PAGE 1 ---
Notice Inviting Tender (NIT).
Tender No: NHAI/DEL/2026/HW-04.
The bidder must submit an Earnest Money Deposit (EMD) of INR 10,00,000 in the form of Bank Guarantee on a 100 Rupee stamp paper with notarization.

--- PAGE 2 ---
General Conditions of Contract (GCC).
Clause 18: Eligibility Criteria.
Bidder must have minimum annual turnover of INR 50 Crores with CA certificate bearing valid UDIN.`;

  beforeEach(() => {
    bidRepo = new InMemoryBidRepository();
    documentRepo = new InMemoryTenderDocumentRepository();
    jobRepo = new InMemoryIngestionJobRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    storageService = new MockStorageService();
    jobQueue = new MockSqsJobQueue(3);
    unitOfWork = new DirectUnitOfWork();
    eventBus = new InMemoryEventBus();
    normalizer = new DocumentContentNormalizer();

    createBidUseCase = new CreateBidUseCase(bidRepo, auditRepo, unitOfWork);
    generateUploadUrlUseCase = new GenerateUploadUrlUseCase(
      bidRepo,
      documentRepo,
      storageService,
      auditRepo,
      unitOfWork,
    );
    confirmUploadUseCase = new ConfirmDocumentUploadUseCase(
      bidRepo,
      documentRepo,
      storageService,
      auditRepo,
      unitOfWork,
      jobRepo,
      jobQueue,
    );

    // AI Document Extractor configured with mock fetch simulating the FastAPI LangGraph compliance engine
    aiExtractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async (url, init) => {
        const body = JSON.parse(init.body as string);
        expect(body.security_context.tenant_id).toBe(tenantA);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            bid_id: body.bid_id,
            document_id: body.document_id,
            status: 'REVIEW_READY',
            items: [
              {
                category: 'FINANCIAL',
                title: 'Earnest Money Deposit (EMD) Guarantee',
                description: 'INR 10,00,000 on Rs 100 stamp paper with notarization',
                executionRules: {
                  stampPaperRequired: true,
                  stampPaperDenominationInr: 100,
                  notarizationRequired: true,
                  udinRequired: false,
                  signingAuthorityRank: 'Authorized Signatory',
                },
                provenance: {
                  sourceDocumentId: body.document_id,
                  sourceFileName: body.file_name,
                  pageNumber: 1,
                  clauseReference: 'NIT Section 4',
                  verbatimQuote:
                    'The bidder must submit an Earnest Money Deposit (EMD) of INR 10,00,000 in the form of Bank Guarantee on a 100 Rupee stamp paper with notarization.',
                  confidenceScore: 0.99,
                },
              },
              {
                category: 'TECHNICAL',
                title: 'Technical Qualification & Past Performance',
                description:
                  'Minimum turnover of INR 50 Crores with CA certificate bearing valid UDIN',
                executionRules: {
                  stampPaperRequired: false,
                  stampPaperDenominationInr: null,
                  notarizationRequired: false,
                  udinRequired: true,
                  signingAuthorityRank: 'Statutory Auditor / CA',
                },
                provenance: {
                  sourceDocumentId: body.document_id,
                  sourceFileName: body.file_name,
                  pageNumber: 2,
                  clauseReference: 'GCC Clause 18',
                  verbatimQuote:
                    'Bidder must have minimum annual turnover of INR 50 Crores with CA certificate bearing valid UDIN.',
                  confidenceScore: 0.96,
                },
              },
            ],
            human_review_required: false,
            audit_events: [],
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
      'worker-production-ai-1',
      eventBus,
    );
  });

  const setupBidAndVerifiedUpload = async (tenantId = tenantA) => {
    return TenantContextHolder.run(
      {
        organizationId: tenantId,
        userId: bidManagerUser,
        role: 'BID_MANAGER',
      },
      async () => {
        const bid = await createBidUseCase.execute({
          organizationId: tenantId,
          userId: bidManagerUser,
          title: 'NHAI Greenfield Highway Package 2',
          tenderNumber: 'NHAI/2026/GF-02',
          tenderingAuthority: 'National Highways Authority of India',
          estimatedValueRupees: 950000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 45),
        });

        const uploadSession = await generateUploadUrlUseCase.execute({
          organizationId: tenantId,
          userId: bidManagerUser,
          bidId: bid.id,
          documentType: 'NIT',
          fileName: 'NIT_Greenfield_Package2.pdf',
          sizeBytes: 2097152,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Seed object and content in simulated S3 storage
        storageService.simulateUploadedObject(
          uploadSession.s3Key,
          2097152,
          validChecksum,
          simulatedTenderText,
        );

        // Confirm upload: transitions Doc to VERIFIED, Bid to QUEUED, creates IngestionJob (PENDING), enqueues to SQS
        const confirmResult = await confirmUploadUseCase.execute({
          organizationId: tenantId,
          userId: bidManagerUser,
          bidId: bid.id,
          documentId: uploadSession.documentId,
        });

        return {
          bidId: bid.id,
          documentId: uploadSession.documentId,
          jobId: confirmResult.jobId,
          s3Key: uploadSession.s3Key,
        };
      },
    );
  };

  it('1. Full Target Flow: S3 → SQS → Worker → Normalized Content → AI Workflow → Deterministic Validation → PostgreSQL → Notification/Review', async () => {
    const publishedEvents: ComplianceIngestionCompletedEvent[] = [];
    eventBus.subscribe('tenderpulse.compliance.ingestion-completed.v1', async (event) => {
      publishedEvents.push(event as ComplianceIngestionCompletedEvent);
    });

    const { bidId, jobId, documentId } = await setupBidAndVerifiedUpload();

    // Verify initial queue and database state
    expect(jobQueue.getActiveMessageCount()).toBe(1);
    const initialJob = await jobRepo.findById(jobId, tenantA);
    expect(initialJob?.status).toBe('PENDING');

    const initialBid = await bidRepo.findById(bidId, tenantA);
    expect(initialBid?.status.value).toBe('QUEUED');

    // Worker polls and processes the pipeline message
    const result = await worker.pollAndProcess();

    expect(result.processed).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.jobId).toBe(jobId);
    expect(result.itemsCount).toBe(2);

    // Queue is empty (message deleted after success)
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // Verify DB state updates: Job COMPLETED, Bid REVIEW_READY
    const completedJob = await jobRepo.findById(jobId, tenantA);
    expect(completedJob?.status).toBe('COMPLETED');
    expect(completedJob?.attemptCount).toBe(1);
    expect(completedJob?.lockedUntil).toBeNull();

    const updatedBid = await bidRepo.findById(bidId, tenantA);
    expect(updatedBid?.status.value).toBe('REVIEW_READY');

    // Verify ComplianceItems in PostgreSQL
    const complianceItems = await complianceRepo.findByBidId(bidId, tenantA);
    expect(complianceItems).toHaveLength(2);

    const emdItem = complianceItems.find((i) => i.category === 'FINANCIAL')!;
    expect(emdItem.title).toBe('Earnest Money Deposit (EMD) Guarantee');
    expect(emdItem.executionRules.stampPaperRequired).toBe(true);
    expect(emdItem.executionRules.stampPaperDenominationInr).toBe(100);
    expect(emdItem.provenance.sourceDocumentId).toBe(documentId);
    expect(emdItem.provenance.pageNumber).toBe(1);

    const techItem = complianceItems.find((i) => i.category === 'TECHNICAL')!;
    expect(techItem.title).toBe('Technical Qualification & Past Performance');
    expect(techItem.executionRules.udinRequired).toBe(true);
    expect(techItem.provenance.pageNumber).toBe(2);

    // Verify Reference-only Audit Trail recorded
    const auditLogs = await auditRepo.findByEntity(tenantA, 'IngestionJob', jobId);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('INGESTION_JOB_COMPLETED');
    expect(auditLogs[0].diff?.extractedItemsCount).toBe(2);

    // Verify Domain Event notification emitted for review / real-time SSE
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].organizationId).toBe(tenantA);
    expect(publishedEvents[0].payload.newBidStatus).toBe('REVIEW_READY');
  });

  it('2. Idempotency: Handles SQS at-least-once duplicate delivery without duplicate DB items', async () => {
    const { bidId, jobId, documentId } = await setupBidAndVerifiedUpload();

    // First processing
    const firstResult = await worker.pollAndProcess();
    expect(firstResult.status).toBe('COMPLETED');

    const itemsAfterFirst = await complianceRepo.findByBidId(bidId, tenantA);
    expect(itemsAfterFirst).toHaveLength(2);

    // Simulate SQS At-Least-Once duplicate message delivery
    await jobQueue.enqueue({
      jobId,
      organizationId: tenantA,
      bidId,
      documentId,
      timestamp: new Date().toISOString(),
    });
    expect(jobQueue.getActiveMessageCount()).toBe(1);

    // Worker polls duplicate message
    const duplicateResult = await worker.pollAndProcess();

    expect(duplicateResult.processed).toBe(true);
    expect(duplicateResult.status).toBe('ALREADY_COMPLETED');
    expect(duplicateResult.jobId).toBe(jobId);

    // SQS duplicate message deleted
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // CRITICAL: Database compliance items must NOT be duplicated!
    const itemsAfterDuplicate = await complianceRepo.findByBidId(bidId, tenantA);
    expect(itemsAfterDuplicate).toHaveLength(2);
  });

  it('3. Worker Crash Recovery: Resumes gracefully after visibility timeout and lease expiration', async () => {
    const { bidId, jobId } = await setupBidAndVerifiedUpload();

    // Worker 1 claims job
    const messages = await jobQueue.receiveMessages(1, 300);
    expect(messages).toHaveLength(1);
    const msg = messages[0];

    const job = (await jobRepo.findById(jobId, tenantA))!;
    job.claim(300000);
    await jobRepo.update(job);

    expect(job.status).toBe('PROCESSING');
    expect(job.isLeaseExpired()).toBe(false);

    // Simulate Worker 1 crashing mid-execution. Message remains hidden during visibility timeout
    const noMessages = await jobQueue.receiveMessages(1, 300);
    expect(noMessages).toHaveLength(0);

    // Simulate visibility timeout expiry and DB lease expiry
    jobQueue.simulateVisibilityExpiration(msg.receiptHandle);
    const expiredJob = new IngestionJob({
      id: job.id,
      organizationId: job.organizationId,
      bidId: job.bidId,
      documentId: job.documentId,
      status: 'PROCESSING',
      attemptCount: 1,
      maxAttempts: 3,
      lockedUntil: new Date(Date.now() - 5000), // expired 5 seconds ago
      version: job.version,
    });
    await jobRepo.update(expiredJob);
    expect(expiredJob.isLeaseExpired()).toBe(true);

    // Worker 2 picks up message and completes job
    const recoveryResult = await worker.pollAndProcess();

    expect(recoveryResult.processed).toBe(true);
    expect(recoveryResult.status).toBe('COMPLETED');

    const finishedJob = await jobRepo.findById(jobId, tenantA);
    expect(finishedJob?.status).toBe('COMPLETED');
    expect(finishedJob?.attemptCount).toBe(2);

    const items = await complianceRepo.findByBidId(bidId, tenantA);
    expect(items).toHaveLength(2);
  });

  it('4. Retries & Exponential Backoff: Schedules backoff on transient AI service failure', async () => {
    const { jobId } = await setupBidAndVerifiedUpload();

    // Configure extractor to simulate a transient AI failure (e.g. LLM rate limit or 503)
    let callCount = 0;
    const transientAiExtractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: 'AI inference gateway temporarily overloaded' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [],
          }),
        };
      },
    });

    const transientWorker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      transientAiExtractor,
    );

    // First attempt fails with transient error
    const firstResult = await transientWorker.pollAndProcess();

    expect(firstResult.processed).toBe(false);
    expect(firstResult.status).toBe('RETRY_SCHEDULED');
    expect(firstResult.attempts).toBe(1);
    expect(firstResult.backoffSeconds).toBe(30); // 30s initial backoff

    // Job in DB reflects failure attempt
    const jobAfterFail = await jobRepo.findById(jobId, tenantA);
    expect(jobAfterFail?.status).toBe('FAILED');
    expect(jobAfterFail?.attemptCount).toBe(1);
    expect(jobAfterFail?.lastError).toContain('HTTP 503');
  });

  it('5. Poison Pill & DLQ: Moves to Dead-Letter Queue after 3 failed attempts', async () => {
    const { jobId } = await setupBidAndVerifiedUpload();

    // Extractor that permanently fails on a corrupted document
    const brokenExtractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            error: 'Fatal PDF decompression error: corrupt cross-reference stream',
          }),
        };
      },
    });

    const brokenWorker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      brokenExtractor,
    );

    // Attempt 1: Fails -> Retry 1
    const r1 = await brokenWorker.pollAndProcess();
    expect(r1.status).toBe('RETRY_SCHEDULED');
    expect(r1.attempts).toBe(1);

    // Simulate backoff visibility expiration
    jobQueue.simulateVisibilityExpiration();

    // Attempt 2: Fails -> Retry 2
    const r2 = await brokenWorker.pollAndProcess();
    expect(r2.status).toBe('RETRY_SCHEDULED');
    expect(r2.attempts).toBe(2);

    // Simulate backoff visibility expiration
    jobQueue.simulateVisibilityExpiration();

    // Attempt 3: Fails -> Exceeds maxAttempts (3) -> Moved to DLQ!
    const r3 = await brokenWorker.pollAndProcess();
    expect(r3.processed).toBe(false);
    expect(r3.status).toBe('DEAD_LETTER');
    expect(r3.attempts).toBe(3);

    // Primary queue is empty; DLQ has the poison pill
    expect(jobQueue.getActiveMessageCount()).toBe(0);
    const dlqMessages = await jobQueue.getDeadLetterMessages();
    expect(dlqMessages).toHaveLength(1);

    // Job status in PostgreSQL is marked DEAD_LETTER
    const deadJob = await jobRepo.findById(jobId, tenantA);
    expect(deadJob?.status).toBe('DEAD_LETTER');
  });

  it('6. Authorization & Anti-IDOR: Rejects and drops tampered message with tenant mismatch', async () => {
    const { bidId, jobId, documentId } = await setupBidAndVerifiedUpload();

    // Clear primary queue to isolate the tampered message test
    jobQueue.clear();

    // Attacker Tenant B tries to claim Tenant A's document via forged message
    await jobQueue.enqueue({
      jobId,
      organizationId: tenantB, // Maliciously forged tenant ID!
      bidId,
      documentId,
      timestamp: new Date().toISOString(),
    });

    const authResult = await worker.pollAndProcess();

    expect(authResult.processed).toBe(false);
    expect(authResult.reason).toBe('UNAUTHORIZED_JOB_NOT_FOUND');

    // Message is dropped from primary queue and moved to DLQ as a security violation
    expect(jobQueue.getActiveMessageCount()).toBe(0);
    const dlqMessages = await jobQueue.getDeadLetterMessages();
    expect(dlqMessages).toHaveLength(1);
    expect(dlqMessages[0].reason).toContain('SECURITY_VIOLATION');
  });

  it('7. Deterministic Invariant Validation: Blocks persistence if AI emits invalid execution rules', async () => {
    const { bidId } = await setupBidAndVerifiedUpload();

    // Mock extractor that returns an invalid stamp paper denomination (negative amount)
    const invalidAiExtractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async (url, init) => {
        const body = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            bid_id: body.bid_id,
            document_id: body.document_id,
            status: 'REVIEW_READY',
            items: [
              {
                category: 'FINANCIAL',
                title: 'Invalid Stamp Paper Item',
                description: 'Requires stamp paper but negative denomination',
                executionRules: {
                  stampPaperRequired: true,
                  stampPaperDenominationInr: -500, // VIOLATES DETERMINISTIC INVARIANT!
                  notarizationRequired: true,
                  udinRequired: false,
                  signingAuthorityRank: 'Authorized Signatory',
                },
                provenance: {
                  sourceDocumentId: body.document_id,
                  sourceFileName: body.file_name,
                  pageNumber: 1,
                  clauseReference: 'Clause 1',
                  verbatimQuote: 'Some valid quote',
                  confidenceScore: 0.9,
                },
              },
            ],
          }),
        };
      },
    });

    const strictWorker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      invalidAiExtractor,
    );

    const failResult = await strictWorker.pollAndProcess();

    expect(failResult.processed).toBe(false);
    expect(failResult.status).toBe('RETRY_SCHEDULED');
    expect(failResult.error).toContain('invalid stamp paper denomination');

    // CRITICAL: Invalid compliance item was NOT saved to PostgreSQL!
    const items = await complianceRepo.findByBidId(bidId, tenantA);
    expect(items).toHaveLength(0);
  });
});
