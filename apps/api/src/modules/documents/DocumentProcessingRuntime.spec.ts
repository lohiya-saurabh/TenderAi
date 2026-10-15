import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { and, eq } from 'drizzle-orm';
import { createDrizzle } from '../../common/database/database.module.js';
import { initDatabase } from '../../common/database/database.provider.js';
import * as schema from '../../common/database/schema.js';
import type {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
} from '../bids/application/IJobQueue.js';
import { DocumentProcessingRuntime } from './DocumentProcessingRuntime.js';
import { DocumentCompletionService } from './DocumentCompletionService.js';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';

describe('DocumentProcessingRuntime (Option B: Two-Queue Architecture)', () => {
  let database: PGlite | undefined;
  let runtime: DocumentProcessingRuntime | undefined;

  afterEach(async () => {
    if (runtime) {
      await runtime.onModuleDestroy();
      runtime = undefined;
    }
    if (database) {
      await database.close();
      database = undefined;
    }
    vi.unstubAllEnvs();
  });

  it('publishes pending outbox records to the Ingestion Queue and never polls the Ingestion Queue', async () => {
    vi.stubEnv('DOCUMENT_PROCESSING_CONSUMER_ENABLED', 'true');
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    const db = createDrizzle(database);
    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();
    if (!bid) throw new Error('Test database did not seed a bid.');

    const documentId = `doc-outbox-test-${Date.now()}`;
    const storageReference = `tenants/${bid.organizationId}/bids/${bid.id}/${documentId}/tender.pdf`;
    const message: IngestionJobMessage = {
      jobId: `job-${documentId}`,
      organizationId: bid.organizationId,
      companyId: bid.companyId,
      bidId: bid.id,
      documentId,
      workflowRunId: `run-${documentId}`,
      correlationId: `corr-${documentId}`,
      storageReference,
      documentType: 'NIT',
      fileName: 'tender.pdf',
      timestamp: new Date().toISOString(),
    };

    await db.insert(schema.tenderDocuments).values({
      id: documentId,
      bidId: bid.id,
      organizationId: bid.organizationId,
      fileName: 'tender.pdf',
      storagePath: storageReference,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'QUEUED_FOR_EXTRACTION',
    });

    await db.insert(schema.documentProcessingOutbox).values({
      id: `outbox-${documentId}`,
      organizationId: bid.organizationId,
      documentId,
      payload: message,
      status: 'PENDING',
    });

    let publishedCount = 0;
    const ingestionReceiveMock = vi.fn(async () => []);

    const ingestionQueue: IJobQueue = {
      enqueue: async (publishedMessage) => {
        expect(publishedMessage).toEqual(message);
        publishedCount += 1;
      },
      receiveMessages: ingestionReceiveMock,
      deleteMessage: async () => {},
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    const completionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async () => [],
      deleteMessage: async () => {},
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    runtime = new DocumentProcessingRuntime(db, ingestionQueue, completionQueue);
    runtime.onModuleInit();

    await vi.waitFor(() => {
      expect(publishedCount).toBe(1);
    });

    const [outbox] = await db
      .select({ status: schema.documentProcessingOutbox.status })
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.id, `outbox-${documentId}`));
    expect(outbox?.status).toBe('PUBLISHED');

    // Crucial check: NestJS must NEVER poll or consume from the Ingestion Queue
    expect(ingestionReceiveMock).not.toHaveBeenCalled();
  });

  it('consumes completion events from the Completion Queue and atomically persists compliance items', async () => {
    vi.stubEnv('DOCUMENT_PROCESSING_CONSUMER_ENABLED', 'true');
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    const db = createDrizzle(database);
    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();
    if (!bid) throw new Error('Test database did not seed a bid.');

    const documentId = `doc-comp-test-${Date.now()}`;
    const storageReference = `tenants/${bid.organizationId}/bids/${bid.id}/${documentId}/tender.pdf`;

    await db.insert(schema.tenderDocuments).values({
      id: documentId,
      bidId: bid.id,
      organizationId: bid.organizationId,
      fileName: 'tender.pdf',
      storagePath: storageReference,
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'QUEUED_FOR_EXTRACTION',
    });

    const reviewedComplianceId = `legacy-compliance-${documentId}`;
    await db.insert(schema.complianceItems).values({
      id: reviewedComplianceId,
      bidId: bid.id,
      organizationId: bid.organizationId,
      companyId: bid.companyId,
      category: 'FINANCIAL',
      title: 'Earnest Money Deposit',
      description: 'Previously extracted deposit requirement.',
      status: 'READY',
      humanReviewRequired: false,
      reviewNotes: 'Verified by reviewer.',
      version: 4,
      executionRules: {
        stampPaperRequired: false,
        notarizationRequired: false,
        udinRequired: false,
        signingAuthorityRank: 'Authorized Signatory',
      },
      provenance: {
        documentId,
        sourceDocumentId: documentId,
        documentName: 'tender.pdf',
        sourceFileName: 'tender.pdf',
        pageNumber: 1,
        sectionOrClause: 'Clause 4.1',
        clauseReference: 'Clause 4.1',
        verbatimQuote: 'The EMD amount will be deposited.',
        confidenceScore: 0.7,
      },
    });

    const completionEvent: DocumentExtractionCompletedEvent = {
      jobId: `job-${documentId}`,
      organizationId: bid.organizationId,
      companyId: bid.companyId,
      bidId: bid.id,
      documentId,
      status: 'COMPLETED',
      items: [
        {
          category: 'FINANCIAL',
          title: 'Earnest Money Deposit',
          description: 'Submit the stated bid security.',
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: 1,
            clauseReference: 'Clause 4.1',
            verbatimQuote: 'The bidder must submit earnest money deposit of INR 50,00,000.',
            confidenceScore: 0.98,
          },
        },
      ],
    };

    let delivered = false;
    let acknowledged = false;

    const ingestionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async () => [],
      deleteMessage: async () => {},
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    const completionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async (): Promise<QueueMessage<unknown>[]> => {
        if (delivered) return [];
        delivered = true;
        return [
          {
            receiptHandle: 'receipt-comp-1',
            body: completionEvent,
            receiveCount: 1,
          },
        ];
      },
      deleteMessage: async (handle) => {
        if (handle === 'receipt-comp-1') {
          acknowledged = true;
        }
      },
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    runtime = new DocumentProcessingRuntime(db, ingestionQueue, completionQueue);
    runtime.onModuleInit();

    await vi.waitFor(() => {
      expect(acknowledged).toBe(true);
    });

    const [persistedDocument] = await db
      .select({ status: schema.tenderDocuments.status })
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, documentId))
      .limit(1);
    expect(persistedDocument?.status).toBe('COMPLETED');

    const persistedItems = await db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bid.id),
          eq(schema.complianceItems.organizationId, bid.organizationId),
        ),
      );
    expect(
      persistedItems.filter((item) => item.provenance.documentId === documentId),
    ).toHaveLength(1);

    const refreshed = persistedItems.find((item) => item.id === reviewedComplianceId);
    expect(refreshed?.provenance.verbatimQuote).toBe(
      'The bidder must submit earnest money deposit of INR 50,00,000.',
    );
    expect(refreshed?.status).toBe('READY');
    expect(refreshed?.humanReviewRequired).toBe(false);
    expect(refreshed?.version).toBe(4);
  });

  it('routes malformed completion messages missing required identifiers to dead-letter queue', async () => {
    vi.stubEnv('DOCUMENT_PROCESSING_CONSUMER_ENABLED', 'true');
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    const db = createDrizzle(database);

    let deadLettered = false;
    let deleted = false;
    let delivered = false;

    const ingestionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async () => [],
      deleteMessage: async () => {},
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    const completionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async (): Promise<QueueMessage<unknown>[]> => {
        if (delivered) return [];
        delivered = true;
        return [
          {
            receiptHandle: 'receipt-malformed-1',
            body: { status: 'COMPLETED' }, // missing documentId, bidId, organizationId
            receiveCount: 1,
          },
        ];
      },
      deleteMessage: async () => {
        deleted = true;
      },
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {
        deadLettered = true;
      },
      getDeadLetterMessages: async () => [],
    };

    runtime = new DocumentProcessingRuntime(db, ingestionQueue, completionQueue);
    runtime.onModuleInit();

    await vi.waitFor(() => {
      expect(deadLettered).toBe(true);
      expect(deleted).toBe(true);
    });
  });

  it('updates tender document status to FAILED and records lastProcessingError when completion processing exceeds max attempts', async () => {
    vi.stubEnv('DOCUMENT_PROCESSING_CONSUMER_ENABLED', 'true');
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    const db = createDrizzle(database);

    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();
    if (!bid) throw new Error('Test database did not seed a bid.');

    const docId = `doc-dlq-fail-${Date.now()}`;
    await db.insert(schema.tenderDocuments).values({
      id: docId,
      bidId: bid.id,
      organizationId: bid.organizationId,
      fileName: 'faulty.pdf',
      storagePath: `tenants/${bid.organizationId}/bids/${bid.id}/${docId}/faulty.pdf`,
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'PROCESSING',
    });

    let deadLettered = false;
    let deleted = false;
    let delivered = false;

    const ingestionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async () => [],
      deleteMessage: async () => {},
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {},
      getDeadLetterMessages: async () => [],
    };

    const completionQueue: IJobQueue = {
      enqueue: async () => {},
      receiveMessages: async (): Promise<QueueMessage<unknown>[]> => {
        if (delivered) return [];
        delivered = true;
        return [
          {
            receiptHandle: 'receipt-fail-max-1',
            body: {
              documentId: docId,
              bidId: bid.id,
              organizationId: bid.organizationId,
              status: 'COMPLETED',
              items: [
                {
                  // Invalid item: negative denomination triggers throw
                  category: 'STATUTORY',
                  title: 'Invalid Denomination',
                  executionRules: { stampPaperRequired: true, stampPaperDenominationInr: -50 },
                  provenance: { pageNumber: 1, verbatimQuote: 'Quote' },
                },
              ],
            },
            receiveCount: 3, // Already at MAX_PROCESSING_ATTEMPTS
          },
        ];
      },
      deleteMessage: async () => {
        deleted = true;
      },
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {
        deadLettered = true;
      },
      getDeadLetterMessages: async () => [],
    };

    runtime = new DocumentProcessingRuntime(db, ingestionQueue, completionQueue);
    runtime.onModuleInit();

    await vi.waitFor(async () => {
      expect(deadLettered).toBe(true);
      expect(deleted).toBe(true);

      const [updatedDoc] = await db
        .select()
        .from(schema.tenderDocuments)
        .where(eq(schema.tenderDocuments.id, docId));

      expect(updatedDoc?.status).toBe('FAILED');
      expect(updatedDoc?.lastProcessingError).toContain('Exceeded max attempts (3)');
    });
  });

  it('only marks bid as REVIEW_READY when all documents have reached terminal state', async () => {
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: false,
    });
    const db = createDrizzle(database);

    const testOrgId = 'org_acme_infra_001';
    const testBidId = `bid-multi-doc-${Date.now()}`;
    const doc1Id = `doc-part1-${Date.now()}`;
    const doc2Id = `doc-part2-${Date.now()}`;

    await db.insert(schema.bids).values({
      id: testBidId,
      organizationId: testOrgId,
      companyId: 'comp_acme_infra_001',
      title: 'Multi-Document Tender',
      tenderNumber: 'TND-MULTI-01',
      status: 'PROCESSING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.tenderDocuments).values([
      {
        id: doc1Id,
        bidId: testBidId,
        organizationId: testOrgId,
        fileName: 'Volume1_NIT.pdf',
        storagePath: `tenants/${testOrgId}/bids/${testBidId}/${doc1Id}/Volume1.pdf`,
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        documentType: 'NIT',
        status: 'PROCESSING',
      },
      {
        id: doc2Id,
        bidId: testBidId,
        organizationId: testOrgId,
        fileName: 'Volume2_GCC.pdf',
        storagePath: `tenants/${testOrgId}/bids/${testBidId}/${doc2Id}/Volume2.pdf`,
        fileSizeBytes: 4096,
        mimeType: 'application/pdf',
        documentType: 'GCC',
        status: 'PROCESSING',
      },
    ]);

    const completionService = new DocumentCompletionService(db);

    // Complete Volume 1 with stampPaperRequired=true and stampPaperDenominationInr=0 (unspecified)
    const result1 = await completionService.processExtractionCompleted({
      jobId: `job-${doc1Id}`,
      bidId: testBidId,
      documentId: doc1Id,
      organizationId: testOrgId,
      status: 'COMPLETED',
      items: [
        {
          title: 'Power of Attorney on Stamp Paper',
          category: 'STATUTORY',
          description: 'Power of Attorney must be submitted on non-judicial stamp paper.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100, // Valid non-zero denomination
            notarizationRequired: true,
            udinRequired: false,
            signingAuthorityRank: 'Director',
          },
          provenance: {
            pageNumber: 2,
            clauseReference: 'Clause 2.1',
            verbatimQuote: 'Power of Attorney must be submitted on non-judicial stamp paper.',
            confidenceScore: 0.95,
          },
        },
      ],
    });

    expect(result1.processed).toBe(true);

    // Since Volume 2 is still 'PROCESSING', bid status MUST NOT be 'REVIEW_READY' yet!
    const [bidAfterDoc1] = await db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.id, testBidId));
    expect(bidAfterDoc1?.status).not.toBe('REVIEW_READY');

    // Now complete Volume 2
    const result2 = await completionService.processExtractionCompleted({
      jobId: `job-${doc2Id}`,
      bidId: testBidId,
      documentId: doc2Id,
      organizationId: testOrgId,
      status: 'COMPLETED',
      items: [
        {
          title: 'Turnover Requirement',
          category: 'FINANCIAL',
          description: 'Turnover must exceed 50 Cr.',
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: true,
            signingAuthorityRank: 'CA',
          },
          provenance: {
            pageNumber: 5,
            clauseReference: 'GCC 5.1',
            verbatimQuote: 'Turnover must exceed 50 Cr.',
            confidenceScore: 0.98,
          },
        },
      ],
    });

    expect(result2.processed).toBe(true);

    // Now that both Volume 1 and Volume 2 are COMPLETED, bid status transitions to 'REVIEW_READY'
    const [bidAfterDoc2] = await db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.id, testBidId));
    expect(bidAfterDoc2?.status).toBe('REVIEW_READY');
    expect(bidAfterDoc2?.totalRequirements).toBe(2);
  });

  it('marks bid as REVIEW_READY when one document succeeds and another fails (terminal state)', async () => {
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: false,
    });
    const db = createDrizzle(database);

    const testOrgId = 'org_acme_infra_001';
    const testCompanyId = 'comp_acme_infra_001';
    const testBidId = `bid-mixed-terminal-${Date.now()}`;
    const doc1Id = `doc-success-${Date.now()}`;
    const doc2Id = `doc-failure-${Date.now()}`;

    await db.insert(schema.bids).values({
      id: testBidId,
      organizationId: testOrgId,
      companyId: testCompanyId,
      title: 'Multi Document Mixed Terminal Test',
      status: 'PROCESSING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.tenderDocuments).values([
      {
        id: doc1Id,
        bidId: testBidId,
        organizationId: testOrgId,
        fileName: 'Volume1_NIT.pdf',
        storagePath: `tenants/${testOrgId}/bids/${testBidId}/${doc1Id}/Volume1.pdf`,
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        documentType: 'NIT',
        status: 'PROCESSING',
      },
      {
        id: doc2Id,
        bidId: testBidId,
        organizationId: testOrgId,
        fileName: 'Volume2_Corrupted.pdf',
        storagePath: `tenants/${testOrgId}/bids/${testBidId}/${doc2Id}/Volume2.pdf`,
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        documentType: 'OTHER',
        status: 'PROCESSING',
      },
    ]);

    const completionService = new DocumentCompletionService(db);

    // 1. Doc 1 succeeds
    await completionService.processExtractionCompleted({
      jobId: `job-${doc1Id}`,
      bidId: testBidId,
      documentId: doc1Id,
      organizationId: testOrgId,
      status: 'COMPLETED',
      items: [
        {
          title: 'Valid Requirement',
          category: 'TECHNICAL',
          description: 'Experience requirement.',
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: 1,
            clauseReference: 'Cl 1',
            verbatimQuote: 'Experience requirement.',
            confidenceScore: 0.99,
          },
        },
      ],
    });

    // Doc 2 is still PROCESSING, bid should not be REVIEW_READY
    const [bidMidway] = await db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.id, testBidId));
    expect(bidMidway?.status).not.toBe('REVIEW_READY');

    // 2. Doc 2 fails extraction
    await completionService.processExtractionCompleted({
      jobId: `job-${doc2Id}`,
      bidId: testBidId,
      documentId: doc2Id,
      organizationId: testOrgId,
      status: 'FAILED',
      error: 'Corrupted PDF stream.',
      items: [],
    });

    // Now all documents are terminal (Doc 1 COMPLETED, Doc 2 FAILED)
    const [bidFinal] = await db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.id, testBidId));
    expect(bidFinal?.status).toBe('REVIEW_READY');

    const [doc2Record] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, doc2Id));
    expect(doc2Record?.status).toBe('FAILED');
    expect(doc2Record?.lastProcessingError).toBe('Corrupted PDF stream.');
    expect(doc2Record?.processingCompletedAt).toBeInstanceOf(Date);
  });
});
