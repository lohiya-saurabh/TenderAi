import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { and, eq } from 'drizzle-orm';
import { createDrizzle } from '../../common/database/database.module.js';
import { initDatabase } from '../../common/database/database.provider.js';
import * as schema from '../../common/database/schema.js';
import type { DocumentExtractionPort } from '../bids/application/AiDocumentExtractor.js';
import type { IJobQueue, IngestionJobMessage, QueueMessage } from '../bids/application/IJobQueue.js';
import type { IStorageService } from '../bids/application/IStorageService.js';
import { DocumentProcessingRuntime } from './DocumentProcessingRuntime.js';

describe('DocumentProcessingRuntime', () => {
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

  it('persists scoped results before acknowledging and treats duplicate delivery idempotently', async () => {
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

    const documentId = `doc-runtime-${Date.now()}`;
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
    await db.insert(schema.documentProcessingOutbox).values({
      id: `outbox-${documentId}`,
      organizationId: bid.organizationId,
      documentId,
      payload: message,
      status: 'PENDING',
    });

    const extractionPort: DocumentExtractionPort = {
      extract: vi.fn(async (_document, context) => {
        expect(context?.tenantId).toBe(bid.organizationId);
        expect(context?.companyId).toBe(bid.companyId);
        expect(context?.correlationId).toBe(message.correlationId);
        return [{
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
            verbatimQuote: 'The bidder must submit earnest money deposit.',
            confidenceScore: 0.95,
          },
        }];
      }),
    };

    const storage: IStorageService = {
      generatePresignedUploadUrl: async () => 'unused',
      generatePresignedDownloadUrl: async () => 'unused',
      headObject: async () => ({ exists: true, sizeBytes: 2048 }),
      getObject: async () => Buffer.from('unused'),
      deleteObject: async () => {},
      deletePrefix: async () => {},
    };

    let deliveries = 0;
    let acknowledgements = 0;
    let publications = 0;
    let deadLetters = 0;
    const queue: IJobQueue = {
      enqueue: async (publishedMessage) => {
        expect(publishedMessage).toEqual(message);
        publications += 1;
      },
      receiveMessages: async (): Promise<QueueMessage<IngestionJobMessage>[]> => {
        if (deliveries >= 3) return [];
        deliveries += 1;
        return [{
          receiptHandle: `receipt-${deliveries}`,
          body: deliveries === 3 ? { ...message, companyId: 'forged-company' } : message,
          receiveCount: 1,
        }];
      },
      deleteMessage: async () => {
        const [persistedDocument] = await db
          .select({ status: schema.tenderDocuments.status })
          .from(schema.tenderDocuments)
          .where(eq(schema.tenderDocuments.id, documentId))
          .limit(1);
        const persistedItems = await db
          .select()
          .from(schema.complianceItems)
          .where(
            and(
              eq(schema.complianceItems.bidId, bid.id),
              eq(schema.complianceItems.organizationId, bid.organizationId),
            ),
          );
        expect(persistedDocument?.status).toBe('COMPLETED');
        expect(persistedItems.filter((item) => item.provenance.documentId === documentId)).toHaveLength(1);
        const refreshed = persistedItems.find((item) => item.id === reviewedComplianceId);
        expect(refreshed?.provenance.verbatimQuote).toBe('The bidder must submit earnest money deposit.');
        expect(refreshed?.status).toBe('READY');
        expect(refreshed?.humanReviewRequired).toBe(false);
        expect(refreshed?.reviewNotes).toBe('Verified by reviewer.');
        expect(refreshed?.version).toBe(4);
        acknowledgements += 1;
      },
      changeMessageVisibility: async () => {},
      moveToDeadLetter: async () => {
        deadLetters += 1;
      },
      getDeadLetterMessages: async () => [],
    };

    runtime = new DocumentProcessingRuntime(db, storage, queue, extractionPort);
    runtime.onModuleInit();

    await vi.waitFor(() => {
      expect(acknowledgements).toBe(3);
    });

    const finalItems = await db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bid.id),
          eq(schema.complianceItems.organizationId, bid.organizationId),
        ),
      );
    expect(finalItems.filter((item) => item.provenance.documentId === documentId)).toHaveLength(1);
    expect(finalItems.find((item) => item.id === reviewedComplianceId)?.provenance.verbatimQuote)
      .toBe('The bidder must submit earnest money deposit.');
    expect(extractionPort.extract).toHaveBeenCalledTimes(1);
    expect(publications).toBe(1);
    expect(deadLetters).toBe(1);
    const [outbox] = await db
      .select({ status: schema.documentProcessingOutbox.status })
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.id, `outbox-${documentId}`));
    expect(outbox?.status).toBe('PUBLISHED');
  });
});
