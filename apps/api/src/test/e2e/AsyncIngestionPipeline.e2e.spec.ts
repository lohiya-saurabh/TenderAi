import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '../../common/database/IUnitOfWork.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { InMemoryAuditRepository } from '../../modules/audit/infrastructure/InMemoryAuditRepository.js';
import { CreateBidUseCase } from '../../modules/bids/application/CreateBidUseCase.js';
import { GenerateUploadUrlUseCase } from '../../modules/bids/application/GenerateUploadUrlUseCase.js';
import { ConfirmDocumentUploadUseCase } from '../../modules/bids/application/ConfirmDocumentUploadUseCase.js';
import {
  IngestionWorker,
  IDocumentExtractor,
  ExtractedComplianceItem,
} from '../../modules/bids/application/IngestionWorker.js';
import { InMemoryBidRepository } from '../../infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryTenderDocumentRepository } from '../../infrastructure/persistence/InMemoryTenderDocumentRepository.js';
import { InMemoryIngestionJobRepository } from '../../infrastructure/persistence/InMemoryIngestionJobRepository.js';
import { InMemoryComplianceItemRepository } from '../../infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { MockSqsJobQueue } from '../../infrastructure/queue/MockSqsJobQueue.js';
import { IngestionJob } from '../../modules/bids/domain/entities/IngestionJob.js';
import { TenderDocument } from '../../modules/bids/domain/entities/TenderDocument.js';

describe('E2E: Asynchronous Queue Processing & Resilience Architecture (S3 → Job → SQS → Worker → Persistence)', () => {
  let bidRepo: InMemoryBidRepository;
  let documentRepo: InMemoryTenderDocumentRepository;
  let jobRepo: InMemoryIngestionJobRepository;
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let storageService: MockStorageService;
  let jobQueue: MockSqsJobQueue;
  let unitOfWork: DirectUnitOfWork;

  let createBidUseCase: CreateBidUseCase;
  let generateUploadUrlUseCase: GenerateUploadUrlUseCase;
  let confirmUploadUseCase: ConfirmDocumentUploadUseCase;
  let worker: IngestionWorker;

  const tenantA = 'org-contractor-infra-a';
  const tenantB = 'org-contractor-malicious-b';
  const bidManagerUser = 'usr-manager-1';
  const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  beforeEach(() => {
    bidRepo = new InMemoryBidRepository();
    documentRepo = new InMemoryTenderDocumentRepository();
    jobRepo = new InMemoryIngestionJobRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    storageService = new MockStorageService();
    jobQueue = new MockSqsJobQueue(3); // max 3 attempts before DLQ
    unitOfWork = new DirectUnitOfWork();

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

    worker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
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
          title: 'NHAI Highway Expansion Package 4',
          tenderNumber: 'NHAI/2026/HW-04',
          tenderingAuthority: 'National Highways Authority of India',
          estimatedValueRupees: 75000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });

        const uploadSession = await generateUploadUrlUseCase.execute({
          organizationId: tenantId,
          userId: bidManagerUser,
          bidId: bid.id,
          documentType: 'NIT',
          fileName: 'NIT_Package_4.pdf',
          sizeBytes: 1048576,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Simulate S3 object upload
        storageService.simulateUploadedObject(uploadSession.s3Key, 1048576, validChecksum);

        // Confirm upload: creates IngestionJob (PENDING) and enqueues to SQS
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
        };
      },
    );
  };

  it('1. should successfully execute end-to-end async pipeline (S3 → Job → SQS → Worker → DB persistence)', async () => {
    const { bidId, jobId } = await setupBidAndVerifiedUpload();

    // Verify initial queue and DB state
    expect(jobQueue.getActiveMessageCount()).toBe(1);
    const initialJob = await jobRepo.findById(jobId, tenantA);
    expect(initialJob).not.toBeNull();
    expect(initialJob?.status).toBe('PENDING');

    const initialBid = await bidRepo.findById(bidId, tenantA);
    expect(initialBid?.status.value).toBe('QUEUED');

    // Worker polls and processes message
    const result = await worker.pollAndProcess();

    expect(result.processed).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.jobId).toBe(jobId);
    expect(result.itemsCount).toBe(2);

    // Verify queue is now empty (message deleted after success)
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // Verify DB state updates
    const completedJob = await jobRepo.findById(jobId, tenantA);
    expect(completedJob?.status).toBe('COMPLETED');
    expect(completedJob?.attemptCount).toBe(1);
    expect(completedJob?.lockedUntil).toBeNull();

    const updatedBid = await bidRepo.findById(bidId, tenantA);
    expect(updatedBid?.status.value).toBe('REVIEW_READY');

    // Verify compliance items persisted in DB
    const complianceItems = await complianceRepo.findByBidId(bidId, tenantA);
    expect(complianceItems).toHaveLength(2);
    expect(complianceItems[0].category).toBe('FINANCIAL');
    expect(complianceItems[1].category).toBe('TECHNICAL');

    // Verify audit log
    const auditLogs = await auditRepo.findByEntity(tenantA, 'IngestionJob', jobId);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('INGESTION_JOB_COMPLETED');
  });

  it('2. should handle duplicate job delivery idempotently without creating duplicate compliance items', async () => {
    const { bidId, jobId, documentId } = await setupBidAndVerifiedUpload();

    // First delivery & processing
    const firstResult = await worker.pollAndProcess();
    expect(firstResult.status).toBe('COMPLETED');

    const initialItems = await complianceRepo.findByBidId(bidId, tenantA);
    expect(initialItems).toHaveLength(2);

    // Simulate SQS At-Least-Once redelivery of the EXACT same message
    await jobQueue.enqueue({
      jobId,
      organizationId: tenantA,
      bidId,
      documentId,
      timestamp: new Date().toISOString(),
    });
    expect(jobQueue.getActiveMessageCount()).toBe(1);

    // Worker picks up the duplicate message
    const duplicateResult = await worker.pollAndProcess();

    expect(duplicateResult.processed).toBe(true);
    expect(duplicateResult.status).toBe('ALREADY_COMPLETED');
    expect(duplicateResult.jobId).toBe(jobId);

    // Duplicate message must be acknowledged and removed from SQS
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // CRITICAL: Compliance items must NOT be duplicated in DB!
    const itemsAfterDuplicate = await complianceRepo.findByBidId(bidId, tenantA);
    expect(itemsAfterDuplicate).toHaveLength(2);

    // Job state remains COMPLETED
    const job = await jobRepo.findById(jobId, tenantA);
    expect(job?.status).toBe('COMPLETED');
  });

  it('3. should handle worker crash and resume gracefully after visibility timeout expires', async () => {
    const { bidId, jobId } = await setupBidAndVerifiedUpload();

    // Step 1: Worker 1 receives message
    const messages = await jobQueue.receiveMessages(1, 300); // 300s visibility timeout
    expect(messages).toHaveLength(1);
    const msg = messages[0];

    // Worker 1 claims the job in DB
    const job = (await jobRepo.findById(jobId, tenantA))!;
    job.claim(300000);
    await jobRepo.update(job);

    expect(job.status).toBe('PROCESSING');
    expect(job.isLeaseExpired()).toBe(false);

    // Step 2: Simulate Worker 1 process crash (crashes mid-processing without acknowledging or deleting SQS message)
    // SQS message remains invisible until visibility timeout expires...
    const noMessagesWhileLocked = await jobQueue.receiveMessages(1, 300);
    expect(noMessagesWhileLocked).toHaveLength(0); // Hidden from other workers

    // Step 3: Visibility timeout expires in SQS and lease expires in DB
    jobQueue.simulateVisibilityExpiration(msg.receiptHandle);
    // Artificially age the job's lockedUntil timestamp
    const expiredJob = new IngestionJob({
      id: job.id,
      organizationId: job.organizationId,
      bidId: job.bidId,
      documentId: job.documentId,
      status: 'PROCESSING',
      attemptCount: 1,
      maxAttempts: 3,
      lockedUntil: new Date(Date.now() - 5000), // lease expired 5 seconds ago
      version: job.version,
    });
    await jobRepo.update(expiredJob);
    expect(expiredJob.isLeaseExpired()).toBe(true);

    // Step 4: Worker 2 receives the redelivered message and resumes processing
    const worker2 = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      undefined,
      300,
      'worker-ingestion-2',
    );

    const recoveryResult = await worker2.pollAndProcess();

    expect(recoveryResult.processed).toBe(true);
    expect(recoveryResult.status).toBe('COMPLETED');

    // Verify recovery succeeded
    const finalizedJob = await jobRepo.findById(jobId, tenantA);
    expect(finalizedJob?.status).toBe('COMPLETED');
    expect(finalizedJob?.attemptCount).toBe(2); // 1 from crash + 1 from retry

    const finalizedBid = await bidRepo.findById(bidId, tenantA);
    expect(finalizedBid?.status.value).toBe('REVIEW_READY');
  });

  it('4. should support visibility timeout management for long-running jobs', async () => {
    const { jobId } = await setupBidAndVerifiedUpload();

    // Worker receives message with initial 10s visibility
    const messages = await jobQueue.receiveMessages(1, 10);
    expect(messages).toHaveLength(1);
    const receiptHandle = messages[0].receiptHandle;

    // Worker extends visibility timeout because PDF extraction is taking longer (heartbeat / extension)
    await jobQueue.changeMessageVisibility(receiptHandle, 60);

    // Immediate poll by another worker should find 0 messages
    const immediatePoll = await jobQueue.receiveMessages(1, 10);
    expect(immediatePoll).toHaveLength(0);

    // Simulate expiration of the extended visibility timeout
    jobQueue.simulateVisibilityExpiration(receiptHandle);

    // Now message is visible again
    const pollAfterExpiration = await jobQueue.receiveMessages(1, 10);
    expect(pollAfterExpiration).toHaveLength(1);
    expect(pollAfterExpiration[0].body.jobId).toBe(jobId);
  });

  it('5. should retry on transient failure and succeed on subsequent attempt', async () => {
    const { bidId, jobId } = await setupBidAndVerifiedUpload();

    let attempts = 0;
    const flakeyExtractor: IDocumentExtractor = {
      async extract(_doc: TenderDocument): Promise<ExtractedComplianceItem[]> {
        attempts += 1;
        if (attempts === 1) {
          throw new Error(
            'Downstream AI service returned HTTP 429 Too Many Requests (Transient Rate Limit)',
          );
        }
        return [
          {
            category: 'FINANCIAL',
            title: 'Recovered Compliance Item',
            description: 'Extracted successfully after backoff.',
            executionRules: {
              stampPaperRequired: false,
              notarizationRequired: false,
              udinRequired: false,
            },
            provenance: {
              pageNumber: 1,
              clauseReference: 'Clause 1',
              verbatimQuote: 'Valid quote',
              confidenceScore: 0.99,
            },
          },
        ];
      },
    };

    const retryWorker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      flakeyExtractor,
    );

    // Attempt 1: Fails transiently
    const firstResult = await retryWorker.pollAndProcess();
    expect(firstResult.processed).toBe(false);
    expect(firstResult.status).toBe('RETRY_SCHEDULED');
    expect(firstResult.attempts).toBe(1);
    expect(firstResult.backoffSeconds).toBe(30);

    const jobAfterFail = await jobRepo.findById(jobId, tenantA);
    expect(jobAfterFail?.status).toBe('FAILED');
    expect(jobAfterFail?.attemptCount).toBe(1);
    expect(jobAfterFail?.lastError).toContain('HTTP 429');

    // Queue still holds the message (not deleted, not in DLQ)
    expect(jobQueue.getActiveMessageCount()).toBe(1);

    // Simulate retry backoff expiration
    jobQueue.simulateVisibilityExpiration();

    // Attempt 2: Succeeds on retry
    const secondResult = await retryWorker.pollAndProcess();
    expect(secondResult.processed).toBe(true);
    expect(secondResult.status).toBe('COMPLETED');

    const jobAfterSuccess = await jobRepo.findById(jobId, tenantA);
    expect(jobAfterSuccess?.status).toBe('COMPLETED');
    expect(jobAfterSuccess?.attemptCount).toBe(2);

    const bidAfterSuccess = await bidRepo.findById(bidId, tenantA);
    expect(bidAfterSuccess?.status.value).toBe('REVIEW_READY');
  });

  it('6. should route poison pills to Dead-Letter Queue (DLQ) after exceeding maxAttempts', async () => {
    const { jobId } = await setupBidAndVerifiedUpload();

    // Extractor that permanently crashes (poison pill document)
    const poisonExtractor: IDocumentExtractor = {
      async extract(): Promise<ExtractedComplianceItem[]> {
        throw new Error('CORRUPTED_PDF: Unrecoverable syntax error in PDF cross-reference stream.');
      },
    };

    const poisonWorker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      poisonExtractor,
    );

    // Attempt 1: Fails
    const res1 = await poisonWorker.pollAndProcess();
    expect(res1.status).toBe('RETRY_SCHEDULED');
    expect(res1.attempts).toBe(1);

    // Simulate visibility expiry for Attempt 2
    jobQueue.simulateVisibilityExpiration();

    // Attempt 2: Fails
    const res2 = await poisonWorker.pollAndProcess();
    expect(res2.status).toBe('RETRY_SCHEDULED');
    expect(res2.attempts).toBe(2);

    // Simulate visibility expiry for Attempt 3 (Max attempts reached)
    jobQueue.simulateVisibilityExpiration();

    // Attempt 3: Fails and triggers DLQ routing
    const res3 = await poisonWorker.pollAndProcess();
    expect(res3.processed).toBe(false);
    expect(res3.status).toBe('DEAD_LETTER');
    expect(res3.attempts).toBe(3);
    expect(res3.error).toContain('CORRUPTED_PDF');

    // Active queue must now be EMPTY (poison pill purged so healthy messages are not blocked)
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // Dead-Letter Queue must have the poison message
    const dlqMessages = await jobQueue.getDeadLetterMessages();
    expect(dlqMessages).toHaveLength(1);
    expect(dlqMessages[0].message.jobId).toBe(jobId);
    expect(dlqMessages[0].reason).toContain('CORRUPTED_PDF');

    // DB state must be DEAD_LETTER
    const deadJob = await jobRepo.findById(jobId, tenantA);
    expect(deadJob?.status).toBe('DEAD_LETTER');
    expect(deadJob?.lastError).toContain('CORRUPTED_PDF');
  });

  it('7. should reject unauthorized cross-tenant document scopes using trusted backend database state', async () => {
    // Tenant A sets up a legit bid and document, and worker processes it to empty queue
    const { documentId: docA } = await setupBidAndVerifiedUpload(tenantA);
    const legitResult = await worker.pollAndProcess();
    expect(legitResult.processed).toBe(true);
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // Malicious Tenant B sets up their own bid
    const bidB = await TenantContextHolder.run(
      {
        organizationId: tenantB,
        userId: 'usr-attacker-b',
        role: 'BID_MANAGER',
      },
      async () => {
        return createBidUseCase.execute({
          organizationId: tenantB,
          userId: 'usr-attacker-b',
          title: 'Competitor Target Bid',
          tenderNumber: 'COMPETITOR/2026/01',
          tenderingAuthority: 'State Water Board',
          estimatedValueRupees: 10000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
      },
    );

    // Create an ingestion job for Tenant B, but TAMPER the queue message or job to reference Tenant A's document!
    const tamperedJobId = 'job-tampered-b';
    const tamperedJob = new IngestionJob({
      id: tamperedJobId,
      organizationId: tenantB,
      bidId: bidB.id,
      documentId: docA, // Cross-tenant document from Tenant A!
      status: 'PENDING',
    });
    await jobRepo.save(tamperedJob);

    // Enqueue tampered message
    await jobQueue.enqueue({
      jobId: tamperedJobId,
      organizationId: tenantB,
      bidId: bidB.id,
      documentId: docA,
      timestamp: new Date().toISOString(),
    });

    // Worker polls and processes message
    const result = await worker.pollAndProcess();

    // Must be rejected!
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('UNAUTHORIZED_DOCUMENT');

    // Active queue cleared of malicious message
    expect(jobQueue.getActiveMessageCount()).toBe(0);

    // Poison message routed to DLQ with SECURITY_VIOLATION tag
    const dlqMessages = await jobQueue.getDeadLetterMessages();
    expect(dlqMessages).toHaveLength(1);
    expect(dlqMessages[0].reason).toContain('SECURITY_VIOLATION');
    expect(dlqMessages[0].reason).toContain(docA);

    // Job in DB marked DEAD_LETTER with security error
    const jobInDb = await jobRepo.findById(tamperedJobId, tenantB);
    expect(jobInDb?.status).toBe('DEAD_LETTER');
    expect(jobInDb?.lastError).toContain('SECURITY_VIOLATION');

    // Tenant A's document remains untouched and unextracted
    const tenantBCompliance = await complianceRepo.findByBidId(bidB.id, tenantB);
    expect(tenantBCompliance).toHaveLength(0);
  });
});
