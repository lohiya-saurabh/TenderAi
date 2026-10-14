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
});
