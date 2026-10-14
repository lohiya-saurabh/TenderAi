import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '../../common/database/IUnitOfWork.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { InMemoryEventBus } from '../../common/events/InMemoryEventBus.js';
import { InMemoryAuditRepository } from '../../modules/audit/infrastructure/InMemoryAuditRepository.js';
import { CreateBidUseCase } from '../../modules/bids/application/CreateBidUseCase.js';
import { GenerateUploadUrlUseCase } from '../../modules/bids/application/GenerateUploadUrlUseCase.js';
import { ConfirmDocumentUploadUseCase } from '../../modules/bids/application/ConfirmDocumentUploadUseCase.js';
import { IngestionWorker } from '../../modules/bids/application/IngestionWorker.js';
import { ReviewComplianceItemUseCase } from '../../modules/compliance/application/ReviewComplianceItemUseCase.js';
import { InMemoryBidRepository } from '../../infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryTenderDocumentRepository } from '../../infrastructure/persistence/InMemoryTenderDocumentRepository.js';
import { InMemoryIngestionJobRepository } from '../../infrastructure/persistence/InMemoryIngestionJobRepository.js';
import { InMemoryComplianceItemRepository } from '../../infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { MockSqsJobQueue } from '../../infrastructure/queue/MockSqsJobQueue.js';
import { BidProjectCreatedEvent } from '../../modules/bids/domain/events/BidProjectCreatedEvent.js';
import { TenderDocumentUploadedEvent } from '../../modules/bids/domain/events/TenderDocumentUploadedEvent.js';
import { ComplianceIngestionCompletedEvent } from '../../modules/bids/domain/events/ComplianceIngestionCompletedEvent.js';
import { ComplianceItemReviewedEvent } from '../../modules/compliance/domain/events/ComplianceItemReviewedEvent.js';

describe('E2E: Domain Events Architecture & Event-Driven Decoupling', () => {
  let eventBus: InMemoryEventBus;
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
  let reviewComplianceItemUseCase: ReviewComplianceItemUseCase;
  let worker: IngestionWorker;

  const tenantA = 'org-infrastructure-contractor-a';
  const bidManagerUser = 'usr-manager-1';
  const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    bidRepo = new InMemoryBidRepository();
    documentRepo = new InMemoryTenderDocumentRepository();
    jobRepo = new InMemoryIngestionJobRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    storageService = new MockStorageService();
    jobQueue = new MockSqsJobQueue(3);
    unitOfWork = new DirectUnitOfWork();

    createBidUseCase = new CreateBidUseCase(bidRepo, auditRepo, unitOfWork, eventBus);
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
      eventBus,
    );
    reviewComplianceItemUseCase = new ReviewComplianceItemUseCase(
      complianceRepo,
      auditRepo,
      unitOfWork,
      eventBus,
    );
    worker = new IngestionWorker(
      jobQueue,
      jobRepo,
      bidRepo,
      documentRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
      undefined,
      300,
      'worker-ingestion-1',
      eventBus,
    );
  });

  it('1. should emit BidProjectCreatedEvent on successful bid registration and clear aggregate buffer', async () => {
    const receivedEvents: BidProjectCreatedEvent[] = [];
    eventBus.subscribe<BidProjectCreatedEvent>(BidProjectCreatedEvent.EVENT_TYPE, async (event) => {
      receivedEvents.push(event);
    });

    const result = await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        return createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'Delhi Metro Phase 4 Elevated Viaduct',
          tenderNumber: 'DMRC/2026/P4-EV01',
          tenderingAuthority: 'Delhi Metro Rail Corporation',
          estimatedValueRupees: 95000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
      },
    );

    expect(receivedEvents).toHaveLength(1);
    const event = receivedEvents[0];
    expect(event.eventType).toBe('tenderpulse.bids.project-created.v1');
    expect(event.organizationId).toBe(tenantA);
    expect(event.aggregateId).toBe(result.id);
    expect(event.aggregateType).toBe('BidProject');
    expect(event.payload.title).toBe('Delhi Metro Phase 4 Elevated Viaduct');
    expect(event.payload.estimatedValueRupees).toBe(95000000);
    expect(event.payload.status).toBe('DRAFT');

    // Aggregate in repo must have cleared its internal uncommitted event buffer
    const persistedBid = await bidRepo.findById(result.id, tenantA);
    expect(persistedBid?.domainEvents).toHaveLength(0);
  });

  it('2. should emit TenderDocumentUploadedEvent with zero sensitive document contents in payload', async () => {
    const receivedEvents: TenderDocumentUploadedEvent[] = [];
    eventBus.subscribe<TenderDocumentUploadedEvent>(
      TenderDocumentUploadedEvent.EVENT_TYPE,
      async (event) => {
        receivedEvents.push(event);
      },
    );

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const bid = await createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'NHAI Highway Package',
          tenderNumber: 'NHAI/2026/01',
          tenderingAuthority: 'NHAI',
          estimatedValueRupees: 50000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });

        const uploadSession = await generateUploadUrlUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentType: 'NIT',
          fileName: 'NIT_Tender_Notice.pdf',
          sizeBytes: 2048576,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        storageService.simulateUploadedObject(uploadSession.s3Key, 2048576, validChecksum);

        await confirmUploadUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentId: uploadSession.documentId,
        });
      },
    );

    expect(receivedEvents).toHaveLength(1);
    const event = receivedEvents[0];
    expect(event.eventType).toBe('tenderpulse.bids.document-uploaded.v1');
    expect(event.organizationId).toBe(tenantA);
    expect(event.payload.fileName).toBe('NIT_Tender_Notice.pdf');
    expect(event.payload.sizeBytes).toBe(2048576);
    expect(event.payload.checksumSha256).toBe(validChecksum);
    expect(event.payload.status).toBe('VERIFIED');

    // SECURITY INVARIANT: Zero sensitive raw PDF binary or extracted text in event payload
    const payloadKeys = Object.keys(event.payload);
    expect(payloadKeys).not.toContain('fileContent');
    expect(payloadKeys).not.toContain('extractedText');
    expect(payloadKeys).not.toContain('rawText');
    expect(payloadKeys).not.toContain('pdfBytes');
  });

  it('3. should emit ComplianceIngestionCompletedEvent when worker completes analysis', async () => {
    const receivedEvents: ComplianceIngestionCompletedEvent[] = [];
    eventBus.subscribe<ComplianceIngestionCompletedEvent>(
      ComplianceIngestionCompletedEvent.EVENT_TYPE,
      async (event) => {
        receivedEvents.push(event);
      },
    );

    let bidId = '';
    let jobId = '';

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const bid = await createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'Solar Farm Ingestion Test',
          tenderNumber: 'SECI/2026/01',
          tenderingAuthority: 'Solar Energy Corporation of India',
          estimatedValueRupees: 80000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
        bidId = bid.id;

        const uploadSession = await generateUploadUrlUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentType: 'RFP',
          fileName: 'RFP_Solar_Specs.pdf',
          sizeBytes: 1048576,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        storageService.simulateUploadedObject(uploadSession.s3Key, 1048576, validChecksum);

        const confirmResult = await confirmUploadUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentId: uploadSession.documentId,
        });
        jobId = confirmResult.jobId;
      },
    );

    // Worker polls SQS and processes the document
    const workerResult = await worker.pollAndProcess();
    expect(workerResult.status).toBe('COMPLETED');

    // Verify ComplianceIngestionCompletedEvent was published
    expect(receivedEvents).toHaveLength(1);
    const event = receivedEvents[0];
    expect(event.eventType).toBe('tenderpulse.compliance.ingestion-completed.v1');
    expect(event.organizationId).toBe(tenantA);
    expect(event.aggregateId).toBe(jobId);
    expect(event.payload.bidId).toBe(bidId);
    expect(event.payload.itemsCount).toBe(2);
    expect(event.payload.newBidStatus).toBe('REVIEW_READY');

    // SECURITY CHECK: Payload contains count, NOT raw quotes or legal text
    const payloadKeys = Object.keys(event.payload);
    expect(payloadKeys).not.toContain('complianceItems');
    expect(payloadKeys).not.toContain('verbatimQuotes');
  });

  it('4. should emit ComplianceItemReviewedEvent when reviewer updates compliance state', async () => {
    const receivedEvents: ComplianceItemReviewedEvent[] = [];
    eventBus.subscribe<ComplianceItemReviewedEvent>(
      ComplianceItemReviewedEvent.EVENT_TYPE,
      async (event) => {
        receivedEvents.push(event);
      },
    );

    let bidId = '';

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const bid = await createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'Compliance Review Test',
          tenderNumber: 'REV/2026/01',
          tenderingAuthority: 'Authority',
          estimatedValueRupees: 10000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
        bidId = bid.id;

        const uploadSession = await generateUploadUrlUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentType: 'NIT',
          fileName: 'NIT_Doc.pdf',
          sizeBytes: 1048576,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        storageService.simulateUploadedObject(uploadSession.s3Key, 1048576, validChecksum);

        await confirmUploadUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          bidId: bid.id,
          documentId: uploadSession.documentId,
        });
      },
    );

    // Ingest compliance items
    await worker.pollAndProcess();
    const items = await complianceRepo.findByBidId(bidId, tenantA);
    expect(items).toHaveLength(2);
    const targetItem = items[0];

    // Review item
    await reviewComplianceItemUseCase.execute({
      organizationId: tenantA,
      userId: bidManagerUser,
      bidId,
      itemId: targetItem.id,
      status: 'FLAGGED',
      notes: 'Requires clarification from Joint Venture partner regarding net worth calculation.',
      expectedVersion: targetItem.version,
    });

    expect(receivedEvents).toHaveLength(1);
    const event = receivedEvents[0];
    expect(event.eventType).toBe('tenderpulse.compliance.item-reviewed.v1');
    expect(event.organizationId).toBe(tenantA);
    expect(event.payload.itemId).toBe(targetItem.id);
    expect(event.payload.previousStatus).toBe('PENDING');
    expect(event.payload.newStatus).toBe('FLAGGED');
    expect(event.payload.reviewerUserId).toBe(bidManagerUser);
  });

  it('5. should support idempotent subscriber handling using eventId deduplication', async () => {
    const processedEventIds = new Set<string>();
    let executionCount = 0;

    // Idempotent subscriber
    eventBus.subscribe<BidProjectCreatedEvent>(BidProjectCreatedEvent.EVENT_TYPE, async (event) => {
      if (processedEventIds.has(event.eventId)) {
        // Idempotent guard: duplicate event safely ignored
        return;
      }
      processedEventIds.add(event.eventId);
      executionCount += 1;
    });

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        return createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'Idempotency Test Bid',
          tenderNumber: 'IDEM/2026/01',
          tenderingAuthority: 'Authority',
          estimatedValueRupees: 20000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
      },
    );

    expect(executionCount).toBe(1);

    // Simulate event bus at-least-once redelivery of the EXACT same event
    const publishedEvents = eventBus.getEventsByType<BidProjectCreatedEvent>(
      BidProjectCreatedEvent.EVENT_TYPE,
    );
    expect(publishedEvents).toHaveLength(1);

    await eventBus.publish(publishedEvents[0]);

    // Handler was invoked, but idempotent deduplication prevented duplicate side-effect!
    expect(executionCount).toBe(1);
    expect(processedEventIds.size).toBe(1);
  });

  it('6. should isolate subscriber errors without impacting other subscribers or failing the caller', async () => {
    let healthySubscriberRan = false;

    // Failing subscriber (simulating broken third-party integration or temporary network timeout)
    eventBus.subscribe(BidProjectCreatedEvent.EVENT_TYPE, async () => {
      throw new Error('Third-party webhook endpoint returned HTTP 500 Internal Server Error');
    });

    // Healthy subscriber (e.g. Audit or SSE)
    eventBus.subscribe(BidProjectCreatedEvent.EVENT_TYPE, async () => {
      healthySubscriberRan = true;
    });

    // Publishing should not throw an uncaught exception
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        await createBidUseCase.execute({
          organizationId: tenantA,
          userId: bidManagerUser,
          title: 'Resilient Event Test',
          tenderNumber: 'RES/2026/01',
          tenderingAuthority: 'Authority',
          estimatedValueRupees: 30000000,
          submissionDeadline: new Date(Date.now() + 86400000 * 30),
        });
      },
    );

    // Healthy subscriber still executed despite the other subscriber failing
    expect(healthySubscriberRan).toBe(true);
  });
});
