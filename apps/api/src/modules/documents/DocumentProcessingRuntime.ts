import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, lte, or } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import {
  INGESTION_QUEUE_TOKEN,
  COMPLETION_QUEUE_TOKEN,
} from '../../infrastructure/queue/queue.module.js';
import type {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
} from '../bids/application/IJobQueue.js';
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

/**
 * DocumentProcessingRuntime (Event-Driven Cloud Architecture)
 *
 * Responsibilities:
 * 1. PRODUCER (Ingestion Queue): Scans transactional outbox (document_processing_outbox)
 *    and enqueues IngestionJobMessage records to the Ingestion Queue.
 *    NestJS NEVER consumes from the Ingestion Queue.
 *
 * 2. CONSUMER (Completion Queue): Polls the dedicated Completion Queue for
 *    DocumentExtractionCompletedEvent emitted by the Python AI worker.
 *    Delegates atomic single-writer PostgreSQL persistence to DocumentCompletionService
 *    and deletes the completion queue message upon transaction commit.
 */
@Injectable()
export class DocumentProcessingRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger(DocumentProcessingRuntime.name, 'api');
  private running = false;
  private loop: Promise<void> | undefined;

  public readonly completionService: DocumentCompletionService;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    @Inject(INGESTION_QUEUE_TOKEN) public readonly ingestionQueue: IJobQueue,
    @Inject(COMPLETION_QUEUE_TOKEN) public readonly completionQueue: IJobQueue,
    completionService?: DocumentCompletionService,
  ) {
    this.completionService =
      completionService instanceof DocumentCompletionService
        ? completionService
        : new DocumentCompletionService(this.db);
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
        // 1. Transactional Outbox Publisher:
        // Reads pending outbox records and enqueues to the Ingestion Queue.
        // NestJS is strictly the PRODUCER of the Ingestion Queue; it NEVER consumes it.
        await this.publishPendingOutboxMessages();

        // 2. Dedicated Completion Queue Consumer:
        // Polls the Completion Queue for DocumentExtractionCompletedEvent published by Python.
        // NestJS is strictly the CONSUMER of the Completion Queue.
        const [completionMsg] = await this.completionQueue.receiveMessages(
          1,
          VISIBILITY_TIMEOUT_SECONDS,
        );
        if (completionMsg) {
          await this.processCompletionMessage(completionMsg);
          continue;
        }
      } catch (error) {
        this.logger.error(
          'Document processing polling loop encountered an error; worker remains healthy.',
          error,
        );
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /**
   * Publishes pending outbox messages to the Ingestion Queue.
   * Employs optimistic leases to ensure at-least-once durable publishing across replicas.
   */
  public async publishPendingOutboxMessages(): Promise<void> {
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
        await this.ingestionQueue.enqueue(message);
        await this.db
          .update(schema.documentProcessingOutbox)
          .set({
            status: 'PUBLISHED',
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          })
          .where(eq(schema.documentProcessingOutbox.id, record.id));

        this.logger.info(
          'outbox.message.published',
          `Published outbox job ${record.id} (doc: ${record.documentId}) to Ingestion Queue.`,
          { outboxId: record.id, documentId: record.documentId },
        );
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
        this.logger.error(
          `Failed to publish document job ${record.id} to Ingestion Queue; retrying in ${retrySeconds}s.`,
          error,
        );
      }
    }
  }

  /**
   * Processes a completion event received from the dedicated Completion Queue.
   * Enforces Single-Writer Principle: delegates transactional write to DocumentCompletionService,
   * then deletes the message from the completion queue upon success.
   */
  public async processCompletionMessage(
    message: QueueMessage<unknown>,
  ): Promise<void> {
    const { body, receiptHandle, receiveCount } = message;
    const event = body as Partial<DocumentExtractionCompletedEvent>;

    const traceId =
      event.traceId ||
      event.correlationId ||
      `trc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const correlationId = event.correlationId || event.jobId || traceId;

    return LoggingContextHolder.run(
      {
        traceId,
        correlationId,
        jobId: event.jobId,
        tenantId: event.organizationId,
        tenderId: event.bidId,
        documentId: event.documentId,
      },
      async () => {
        const startTime = performance.now();
        this.logger.info(
          'queue.completion_event.received',
          `Received extraction completion event for doc ${event.documentId} (bid: ${event.bidId}, status: ${event.status}, items: ${event.items?.length ?? 0})`,
          {
            jobId: event.jobId,
            documentId: event.documentId,
            status: event.status,
            itemsCount: event.items?.length ?? 0,
            receiveCount,
          },
        );

        const visibilityHeartbeat = setInterval(() => {
          void this.completionQueue
            .changeMessageVisibility(receiptHandle, VISIBILITY_TIMEOUT_SECONDS)
            .catch((error: unknown) =>
              this.logger.error(
                `Could not renew visibility for completion event ${event.jobId}.`,
                error,
              ),
            );
        }, VISIBILITY_RENEWAL_INTERVAL_MS);
        visibilityHeartbeat.unref();

        try {
          if (!event.documentId || !event.bidId || !event.organizationId) {
            this.logger.error(
              `Malformed completion message missing required identifiers (documentId, bidId, or organizationId): ${JSON.stringify(event)}`,
            );
            await this.completionQueue.moveToDeadLetter(
              event as any,
              'Malformed completion message missing documentId, bidId, or organizationId.',
              receiveCount,
            );
            await this.completionQueue.deleteMessage(receiptHandle);
            return;
          }

          // Atomically persist results to PostgreSQL via DocumentCompletionService (Single-Writer Principle)
          await this.completionService.processExtractionCompleted(
            event as DocumentExtractionCompletedEvent,
          );

          // Acknowledge and delete message from completion queue
          await this.completionQueue.deleteMessage(receiptHandle);

          const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
          this.logger.info(
            'queue.completion_event.persisted',
            `Successfully processed and acknowledged completion event for doc ${event.documentId} (${durationMs}ms).`,
            { jobId: event.jobId, durationMs },
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to persist completion event for doc ${event.documentId}; attempt #${receiveCount}.`,
            error,
          );

          if (receiveCount >= MAX_PROCESSING_ATTEMPTS) {
            await this.completionQueue.moveToDeadLetter(
              event as any,
              `Exceeded max attempts (${MAX_PROCESSING_ATTEMPTS}): ${errorMessage}`,
              receiveCount,
            );
            await this.completionQueue.deleteMessage(receiptHandle);
          } else {
            await this.completionQueue.changeMessageVisibility(
              receiptHandle,
              Math.min(30 * 2 ** (receiveCount - 1), 300),
            );
          }
        } finally {
          clearInterval(visibilityHeartbeat);
        }
      },
    );
  }
}
