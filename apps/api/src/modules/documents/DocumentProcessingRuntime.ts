import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import type { SecurityContextDto } from '@tenderpulse/shared-types';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { QUEUE_TOKEN } from '../../infrastructure/queue/queue.module.js';
import { STORAGE_TOKEN } from '../../infrastructure/storage/storage.module.js';
import type { IJobQueue, IngestionJobMessage, QueueMessage } from '../bids/application/IJobQueue.js';
import type { IStorageService } from '../bids/application/IStorageService.js';
import type { DocumentExtractionPort } from '../bids/application/AiDocumentExtractor.js';
import type { DocumentType } from '../bids/domain/entities/TenderDocument.js';
import { DocumentCompletionService } from './DocumentCompletionService.js';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';
import { StructuredLogger } from '../../common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '../../common/logging/LoggingContext.js';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const POLL_INTERVAL_MS = 1_000;
const VISIBILITY_TIMEOUT_SECONDS = 300;
const VISIBILITY_RENEWAL_INTERVAL_MS = 60_000;
const MAX_PROCESSING_ATTEMPTS = 3;
const OUTBOX_LEASE_MS = 5 * 60_000;
export const DOCUMENT_EXTRACTOR_TOKEN = 'DOCUMENT_EXTRACTOR';
const DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  'NIT',
  'RFP',
  'TECHNICAL_SPECS',
  'GCC',
  'SCC',
  'BOQ',
  'CORRIGENDUM',
  'OTHER',
]);

function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPES.has(value);
}

@Injectable()
export class DocumentProcessingRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger(DocumentProcessingRuntime.name, 'api');
  private running = false;
  private loop: Promise<void> | undefined;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    @Inject(STORAGE_TOKEN) private readonly storage: IStorageService,
    @Inject(QUEUE_TOKEN) private readonly queue: IJobQueue,
    @Inject(DOCUMENT_EXTRACTOR_TOKEN) private readonly extractor: DocumentExtractionPort,
    private readonly completionService: DocumentCompletionService = new DocumentCompletionService(db),
  ) {
  }

  public onModuleInit(): void {
    if (process.env.DOCUMENT_PROCESSING_CONSUMER_ENABLED === 'false') {
      this.logger.warn('Document processing consumer is disabled by configuration.');
      return;
    }

    this.running = true;
    this.loop = this.run();
  }

  public async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.loop;
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        await this.publishPendingOutboxMessages();
        const [message] = await this.queue.receiveMessages(1, VISIBILITY_TIMEOUT_SECONDS);
        if (message) {
          await this.processMessage(message);
          continue;
        }
      } catch (error) {
        this.logger.error('Document processing poll failed; the queue message remains eligible for retry.', error);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  private async publishPendingOutboxMessages(): Promise<void> {
    const now = new Date();
    const staleLease = new Date(now.getTime() - OUTBOX_LEASE_MS);
    const pending = await this.db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(
        or(
          and(
            eq(schema.documentProcessingOutbox.status, 'PENDING'),
            lte(schema.documentProcessingOutbox.nextAttemptAt, now),
          ),
          and(
            eq(schema.documentProcessingOutbox.status, 'PUBLISHING'),
            lte(schema.documentProcessingOutbox.lockedAt, staleLease),
          ),
        ),
      )
      .limit(10);

    for (const record of pending) {
      const claim = await this.db
        .update(schema.documentProcessingOutbox)
        .set({ status: 'PUBLISHING', lockedAt: now })
        .where(
          and(
            eq(schema.documentProcessingOutbox.id, record.id),
            or(
              and(
                eq(schema.documentProcessingOutbox.status, 'PENDING'),
                lte(schema.documentProcessingOutbox.nextAttemptAt, now),
              ),
              and(
                eq(schema.documentProcessingOutbox.status, 'PUBLISHING'),
                lte(schema.documentProcessingOutbox.lockedAt, staleLease),
              ),
            ),
          ),
        )
        .returning({ id: schema.documentProcessingOutbox.id });
      if (claim.length === 0) continue;

      const message = record.payload as IngestionJobMessage;
      try {
        await this.queue.enqueue(message);
        await this.db
          .update(schema.documentProcessingOutbox)
          .set({
            status: 'PUBLISHED',
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          })
          .where(eq(schema.documentProcessingOutbox.id, record.id));
      } catch (error) {
        const attempts = record.attempts + 1;
        const retrySeconds = Math.min(5 * 2 ** Math.min(attempts - 1, 6), 300);
        const messageText = error instanceof Error ? error.message : String(error);
        await this.db
          .update(schema.documentProcessingOutbox)
          .set({
            attempts,
            lastError: messageText,
            nextAttemptAt: new Date(Date.now() + retrySeconds * 1000),
            status: 'PENDING',
            lockedAt: null,
          })
          .where(eq(schema.documentProcessingOutbox.id, record.id));
        this.logger.error(`Failed to publish document job ${record.id}; retrying in ${retrySeconds}s.`, error);
      }
    }
  }

  private async processMessage(message: QueueMessage<IngestionJobMessage>): Promise<void> {
    const { body, receiptHandle, receiveCount } = message;
    const completionEvent = body as unknown as Partial<DocumentExtractionCompletedEvent>;

    const traceId =
      body.traceId ||
      body.correlationId ||
      completionEvent.traceId ||
      completionEvent.correlationId ||
      `trc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const correlationId =
      body.correlationId || completionEvent.correlationId || traceId;

    return LoggingContextHolder.run(
      {
        traceId,
        correlationId,
        jobId: body.jobId || completionEvent.jobId,
        tenantId: body.organizationId || completionEvent.organizationId,
        tenderId: body.bidId || completionEvent.bidId,
        documentId: body.documentId || completionEvent.documentId,
      },
      async () => {
        const startTime = performance.now();
        if (completionEvent.items && Array.isArray(completionEvent.items) && completionEvent.documentId && completionEvent.bidId) {
          this.logger.info('queue.completion_event.received', `Received extraction completion event on queue for doc ${completionEvent.documentId}`, {
            documentId: completionEvent.documentId,
            itemsCount: completionEvent.items.length,
          });
          await this.completionService.processExtractionCompleted(completionEvent as DocumentExtractionCompletedEvent);
          await this.queue.deleteMessage(receiptHandle);
          return;
        }

        this.logger.info(
          'job.started',
          `Processing document job ${body.jobId} (Tenant: ${body.organizationId}, Bid: ${body.bidId}, Document: ${body.documentId})`,
          {
            jobId: body.jobId,
            tenantId: body.organizationId,
            bidId: body.bidId,
            documentId: body.documentId,
            receiveCount,
          },
        );
    const [source] = await this.db
      .select({ document: schema.tenderDocuments, bid: schema.bids, company: schema.companies })
      .from(schema.tenderDocuments)
      .innerJoin(
        schema.bids,
        and(
          eq(schema.bids.id, schema.tenderDocuments.bidId),
          eq(schema.bids.organizationId, schema.tenderDocuments.organizationId),
        ),
      )
      .innerJoin(
        schema.companies,
        and(
          eq(schema.companies.id, schema.bids.companyId),
          eq(schema.companies.organizationId, schema.bids.organizationId),
        ),
      )
      .where(
        and(
          eq(schema.tenderDocuments.id, body.documentId),
          eq(schema.tenderDocuments.bidId, body.bidId),
          eq(schema.tenderDocuments.organizationId, body.organizationId),
        ),
      )
      .limit(1);

    if (!source) {
      await this.moveInvalidMessageToDlq(message, 'Document, bid, company, or tenant ownership could not be verified.');
      return;
    }

    if (
      !body.companyId ||
      body.companyId !== source.bid.companyId ||
      source.company.id !== body.companyId
    ) {
      await this.moveInvalidMessageToDlq(message, 'Queue company claim does not match the persisted bid company.');
      return;
    }

    if (!body.storageReference || body.storageReference !== source.document.storagePath) {
      await this.moveInvalidMessageToDlq(message, 'Queue storage reference does not match the persisted document.');
      return;
    }
    if (!isDocumentType(source.document.documentType)) {
      await this.moveInvalidMessageToDlq(message, 'Document type is not supported for extraction.');
      return;
    }

    if (source.document.status === 'COMPLETED') {
      await this.queue.deleteMessage(receiptHandle);
      return;
    }
    if (source.document.status === 'DEAD_LETTER') {
      await this.queue.moveToDeadLetter(
        body,
        source.document.lastProcessingError ?? 'Document processing previously exhausted its attempts.',
        receiveCount,
      );
      await this.queue.deleteMessage(receiptHandle);
      return;
    }

    const staleBefore = new Date(Date.now() - VISIBILITY_TIMEOUT_SECONDS * 1000);
    const claimed = await this.db
      .update(schema.tenderDocuments)
      .set({
        status: 'PROCESSING',
        processingAttempts: sql`${schema.tenderDocuments.processingAttempts} + 1`,
        processingStartedAt: new Date(),
        lastProcessingError: null,
      })
      .where(
        and(
          eq(schema.tenderDocuments.id, source.document.id),
          eq(schema.tenderDocuments.organizationId, source.document.organizationId),
          or(
            eq(schema.tenderDocuments.status, 'QUEUED_FOR_EXTRACTION'),
            eq(schema.tenderDocuments.status, 'FAILED'),
            and(
              eq(schema.tenderDocuments.status, 'PROCESSING'),
              lte(schema.tenderDocuments.processingStartedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({
        id: schema.tenderDocuments.id,
        processingAttempts: schema.tenderDocuments.processingAttempts,
      });

    if (claimed.length === 0) {
      const [currentDocument] = await this.db
        .select({
          status: schema.tenderDocuments.status,
        })
        .from(schema.tenderDocuments)
        .where(
          and(
            eq(schema.tenderDocuments.id, source.document.id),
            eq(schema.tenderDocuments.organizationId, source.document.organizationId),
          ),
        )
        .limit(1);
      if (currentDocument?.status === 'COMPLETED') {
        await this.queue.deleteMessage(receiptHandle);
      } else {
        await this.queue.changeMessageVisibility(receiptHandle, VISIBILITY_RENEWAL_INTERVAL_MS / 1000);
      }
      return;
    }

    this.logger.debug(
      `Claimed DB processing lease for document ${source.document.id} (Attempt #${claimed[0]!.processingAttempts}). Starting extraction...`,
    );

    const visibilityHeartbeat = setInterval(() => {
      void this.queue
        .changeMessageVisibility(receiptHandle, VISIBILITY_TIMEOUT_SECONDS)
        .catch((error: unknown) => this.logger.error(`Could not renew visibility for ${body.jobId}.`, error));
    }, VISIBILITY_RENEWAL_INTERVAL_MS);
    visibilityHeartbeat.unref();

    try {
      const storageHead = await this.storage.headObject(source.document.storagePath);
      if (!storageHead.exists || storageHead.sizeBytes <= 0) {
        throw new Error(`Document object is missing or empty: ${source.document.storagePath}`);
      }

      const securityContext: SecurityContextDto = {
        tenantId: source.bid.organizationId,
        companyId: source.bid.companyId,
        userId: 'document-processing-worker',
        roles: ['ADMIN'],
        workflowRunId: body.workflowRunId ?? body.jobId,
        correlationId: body.correlationId ?? body.jobId,
        allowedDocumentIds: [source.document.id],
        allowedSourceIds: [source.document.storagePath],
        purpose: 'COMPLIANCE_EXTRACTION',
      };
      const dispatchResult = await this.extractor.dispatchExtraction(
        {
          id: source.document.id,
          bidId: source.bid.id,
          organizationId: source.bid.organizationId,
          documentType: source.document.documentType,
          fileName: source.document.fileName,
          storagePath: source.document.storagePath,
        },
        securityContext,
      );
      this.logger.info(
        'extraction.dispatched',
        `Dispatched extraction job ${dispatchResult.jobId} asynchronously to AI engine for doc ${source.document.id}. Awaiting completion event.`,
        { jobId: dispatchResult.jobId, documentId: source.document.id },
      );
      await this.queue.deleteMessage(receiptHandle);
      const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
      this.logger.info(
        'job.completed',
        `Document job ${body.jobId} dispatched and acknowledged (${durationMs}ms).`,
        { jobId: body.jobId },
        { duration_ms: durationMs },
      );
      return;
    } catch (error) {
      await this.handleProcessingFailure(message, claimed[0]!.processingAttempts, error);
      return;
    } finally {
      clearInterval(visibilityHeartbeat);
    }
      },
    );
  }

  private async handleProcessingFailure(
    message: QueueMessage<IngestionJobMessage>,
    attempt: number,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const terminal = attempt >= MAX_PROCESSING_ATTEMPTS || message.receiveCount >= MAX_PROCESSING_ATTEMPTS;
    await this.db
      .update(schema.tenderDocuments)
      .set({
        status: terminal ? 'DEAD_LETTER' : 'FAILED',
        processingStartedAt: null,
        lastProcessingError: errorMessage,
      })
      .where(
        and(
          eq(schema.tenderDocuments.id, message.body.documentId),
          eq(schema.tenderDocuments.organizationId, message.body.organizationId),
        ),
      );

    if (terminal) {
      await this.queue.moveToDeadLetter(message.body, errorMessage, message.receiveCount);
      await this.queue.deleteMessage(message.receiptHandle);
      this.logger.error(`Document job ${message.body.jobId} moved to dead letter after ${attempt} attempts.`, error);
      return;
    }

    const backoffSeconds = Math.min(30 * 2 ** Math.max(attempt - 1, 0), 900);
    await this.queue.changeMessageVisibility(message.receiptHandle, backoffSeconds);
    this.logger.error(`Document job ${message.body.jobId} failed on attempt ${attempt}; retrying.`, error);
  }

  private async moveInvalidMessageToDlq(
    message: QueueMessage<IngestionJobMessage>,
    reason: string,
  ): Promise<void> {
    await this.queue.moveToDeadLetter(message.body, reason, message.receiveCount);
    await this.queue.deleteMessage(message.receiptHandle);
    this.logger.error(`Rejected document job ${message.body.jobId}: ${reason}`);
  }
}
