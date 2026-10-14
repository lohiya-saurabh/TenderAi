import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq, and } from 'drizzle-orm';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';
import { createDrizzle } from '../../common/database/database.module.js';
import { initDatabase } from '../../common/database/database.provider.js';
import * as schema from '../../common/database/schema.js';
import { UnauthorizedTenantAccessException } from '../../common/domain/DomainException.js';
import { DocumentCompletionService } from './DocumentCompletionService.js';
import { CompletionWebhookController } from './CompletionWebhookController.js';
import { AiDocumentExtractor } from '../bids/application/AiDocumentExtractor.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { DocumentContentNormalizer } from '../bids/application/DocumentContentNormalizer.js';

describe('CompletionWebhookController & DocumentCompletionService (Design B)', () => {
  let database: PGlite | undefined;
  let db: ReturnType<typeof createDrizzle>;
  let completionService: DocumentCompletionService;
  let controller: CompletionWebhookController;

  const validKey = 'tenderpulse-internal-secret-2026';

  beforeEach(async () => {
    database = new PGlite();
    await initDatabase(database, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    db = createDrizzle(database);
    completionService = new DocumentCompletionService(db);
    controller = new CompletionWebhookController(completionService);
  });

  afterEach(async () => {
    if (database) {
      await database.close();
      database = undefined;
    }
  });

  it('1. Security Guard: rejects requests without X-Internal-Service-Key', async () => {
    const dummyEvent: DocumentExtractionCompletedEvent = {
      jobId: 'job-1',
      organizationId: 'org_test',
      bidId: 'bid_test',
      documentId: 'doc_test',
      status: 'COMPLETED',
      items: [],
    };

    await expect(
      controller.handleExtractionCompleted(undefined, undefined, dummyEvent),
    ).rejects.toThrow(UnauthorizedTenantAccessException);

    await expect(
      controller.handleExtractionCompleted('wrong-secret-key', undefined, dummyEvent),
    ).rejects.toThrow(UnauthorizedTenantAccessException);
  });

  it('2. Invariant Validation: rejects items with missing verbatim quote or invalid stamp paper', async () => {
    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();

    const invalidQuoteEvent: DocumentExtractionCompletedEvent = {
      jobId: 'job-inv-1',
      organizationId: bid!.organizationId,
      bidId: bid!.id,
      documentId: 'doc-inv-1',
      status: 'COMPLETED',
      items: [
        {
          category: 'FINANCIAL',
          title: 'EMD Guarantee',
          executionRules: { stampPaperRequired: false },
          provenance: {
            pageNumber: 1,
            verbatimQuote: '', // EMPTY QUOTE - VIOLATES INVARIANT
          },
        },
      ],
    };

    await expect(
      controller.handleExtractionCompleted(validKey, undefined, invalidQuoteEvent),
    ).rejects.toThrow('missing its source quote');

    const invalidStampEvent: DocumentExtractionCompletedEvent = {
      jobId: 'job-inv-2',
      organizationId: bid!.organizationId,
      bidId: bid!.id,
      documentId: 'doc-inv-2',
      status: 'COMPLETED',
      items: [
        {
          category: 'FINANCIAL',
          title: 'EMD Guarantee',
          executionRules: { stampPaperRequired: true, stampPaperDenominationInr: 0 }, // INVALID DENOMINATION
          provenance: {
            pageNumber: 1,
            verbatimQuote: 'Valid quote text.',
          },
        },
      ],
    };

    await expect(
      controller.handleExtractionCompleted(validKey, undefined, invalidStampEvent),
    ).rejects.toThrow('invalid stamp-paper denomination');
  });

  it('3. Single-Writer Principle: persists extraction items, marks bid REVIEW_READY, and updates document COMPLETED', async () => {
    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();

    const docId = `doc-webhook-${Date.now()}`;
    const storagePath = `tenants/${bid!.organizationId}/bids/${bid!.id}/${docId}/tender.pdf`;

    await db.insert(schema.tenderDocuments).values({
      id: docId,
      bidId: bid!.id,
      organizationId: bid!.organizationId,
      fileName: 'tender.pdf',
      storagePath,
      fileSizeBytes: 4096,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'PROCESSING',
    });

    const completionEvent: DocumentExtractionCompletedEvent = {
      jobId: `job-${docId}`,
      organizationId: bid!.organizationId,
      companyId: bid!.companyId,
      bidId: bid!.id,
      documentId: docId,
      status: 'COMPLETED',
      items: [
        {
          category: 'FINANCIAL',
          title: 'Mobilization Advance Guarantee',
          description: 'Mobilization advance bank guarantee of 10% contract value.',
          executionRules: {
            stampPaperRequired: true,
            stampPaperDenominationInr: 100,
            notarizationRequired: true,
            udinRequired: false,
            signingAuthorityRank: 'Authorized Signatory',
          },
          provenance: {
            pageNumber: 3,
            clauseReference: 'NIT Sub-Clause 4.1',
            verbatimQuote:
              'The contractor shall provide a Mobilization Advance Guarantee in the form of Bank Guarantee.',
            confidenceScore: 0.98,
          },
        },
        {
          category: 'TECHNICAL',
          title: 'Turnover Experience',
          description: 'Minimum 50 Cr turnover.',
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: true,
            signingAuthorityRank: 'Statutory Auditor',
          },
          provenance: {
            pageNumber: 8,
            clauseReference: 'GCC Clause 18',
            verbatimQuote:
              'Minimum average annual financial turnover of INR 50 Crores with CA certificate bearing UDIN.',
            confidenceScore: 0.96,
          },
        },
      ],
    };

    const result = await controller.handleExtractionCompleted(validKey, undefined, completionEvent);
    expect(result.processed).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(result.itemsCount).toBe(2);

    // Verify Document in PostgreSQL is marked COMPLETED
    const [persistedDoc] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, docId));
    expect(persistedDoc?.status).toBe('COMPLETED');
    expect(persistedDoc?.processingCompletedAt).toBeDefined();

    // Verify Bid in PostgreSQL is transitioned to REVIEW_READY
    const [updatedBid] = await db.select().from(schema.bids).where(eq(schema.bids.id, bid!.id));
    expect(updatedBid?.status).toBe('REVIEW_READY');
    expect(updatedBid?.totalRequirements).toBeGreaterThanOrEqual(2);

    // Verify Compliance Items in PostgreSQL
    const complianceRows = await db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bid!.id),
          eq(schema.complianceItems.organizationId, bid!.organizationId),
        ),
      );
    const mobAdvance = complianceRows.find((c) => c.title.includes('Mobilization Advance'));
    expect(mobAdvance).toBeDefined();
    expect(mobAdvance?.executionRules?.stampPaperRequired).toBe(true);
    expect(mobAdvance?.executionRules?.stampPaperDenominationInr).toBe(100);
    expect(mobAdvance?.provenance?.verbatimQuote).toContain('Mobilization Advance Guarantee');

    // Verify Audit Log was written
    const [auditLog] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.aggregateId, docId));
    expect(auditLog?.eventType).toBe('AI_INGESTION_COMPLETED');
  });

  it('4. Handles FAILED extraction status gracefully', async () => {
    const [bid] = await db.select().from(schema.bids).limit(1);
    expect(bid).toBeDefined();

    const docId = `doc-fail-${Date.now()}`;
    await db.insert(schema.tenderDocuments).values({
      id: docId,
      bidId: bid!.id,
      organizationId: bid!.organizationId,
      fileName: 'corrupt.pdf',
      storagePath: `tenants/${bid!.organizationId}/bids/${bid!.id}/${docId}/corrupt.pdf`,
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      documentType: 'NIT',
      status: 'PROCESSING',
    });

    const failedEvent: DocumentExtractionCompletedEvent = {
      jobId: `job-${docId}`,
      organizationId: bid!.organizationId,
      bidId: bid!.id,
      documentId: docId,
      status: 'FAILED',
      items: [],
      error: 'PDF decompression bomb or corrupt stream',
    };

    const result = await controller.handleExtractionCompleted(validKey, undefined, failedEvent);
    expect(result.processed).toBe(true);
    expect(result.status).toBe('FAILED');

    const [persistedDoc] = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, docId));
    expect(persistedDoc?.status).toBe('FAILED');
    expect(persistedDoc?.lastProcessingError).toContain('decompression bomb');
  });

  it('5. AiDocumentExtractor.dispatchExtraction: triggers non-blocking dispatch to FastAPI worker', async () => {
    const storageService = new MockStorageService();
    const normalizer = new DocumentContentNormalizer();
    storageService.simulateUploadedObject(
      'storage/test.pdf',
      1024,
      'dummy-hash',
      'Sample PDF text',
    );

    let dispatchCalled = false;
    const extractor = new AiDocumentExtractor(storageService, normalizer, {
      customFetch: async (url, init) => {
        expect(url).toContain('/api/v1/worker/process-message');
        const body = JSON.parse(init.body as string);
        expect(body.async_mode).toBe(true);
        expect(body.document_id).toBe('doc-async-01');
        dispatchCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            processed: true,
            status: 'ACCEPTED',
          }),
        };
      },
    });

    const dispatchResult = await extractor.dispatchExtraction({
      id: 'doc-async-01',
      bidId: 'bid-async-01',
      organizationId: 'org-test',
      documentType: 'NIT',
      fileName: 'test.pdf',
      storagePath: 'storage/test.pdf',
    });

    expect(dispatchCalled).toBe(true);
    expect(dispatchResult.dispatched).toBe(true);
    expect(dispatchResult.status).toBe('ACCEPTED');
  });

  it('6. Drops completion event gracefully when document or bid does not exist', async () => {
    const nonExistentDocEvent: DocumentExtractionCompletedEvent = {
      jobId: 'job-orphan-01',
      organizationId: 'org_non_existent',
      companyId: 'comp_non_existent',
      bidId: 'bid-orphan-01',
      documentId: 'doc-orphan-01',
      status: 'COMPLETED',
      items: [
        {
          category: 'FINANCIAL',
          title: 'Orphan Requirement',
          provenance: {
            pageNumber: 1,
            verbatimQuote: 'Some valid quote',
          },
        },
      ],
    };

    const result = await controller.handleExtractionCompleted(
      validKey,
      undefined,
      nonExistentDocEvent,
    );
    expect(result.processed).toBe(false);
    expect(result.status).toBe('DROPPED');
    expect(result.documentId).toBe('doc-orphan-01');
    expect(result.itemsCount).toBe(0);
    expect(result.reason).toContain('not found or ownership changed');

    const nonExistentFailEvent: DocumentExtractionCompletedEvent = {
      jobId: 'job-orphan-fail',
      organizationId: 'org_non_existent',
      companyId: 'comp_non_existent',
      bidId: 'bid-orphan-fail',
      documentId: 'doc-orphan-fail',
      status: 'FAILED',
      items: [],
      error: 'Worker crash',
    };

    const failResult = await controller.handleExtractionCompleted(
      validKey,
      undefined,
      nonExistentFailEvent,
    );
    expect(failResult.processed).toBe(false);
    expect(failResult.status).toBe('DROPPED');
  });
});
