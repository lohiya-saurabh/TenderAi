import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import {
  INGESTION_QUEUE_TOKEN,
  COMPLETION_QUEUE_TOKEN,
} from '@/infrastructure/queue/queue.module.js';
import type {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
} from '@/modules/bids/application/IJobQueue.js';
import { DocumentCompletionService } from '@/modules/documents/DocumentCompletionService.js';
import { DocumentsRepository } from '@/modules/documents/documents.repository.js';
import { DocumentsQueries } from '@/modules/documents/documents.queries.js';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';
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
 *
 * The two run as independent loops: the completion consumer sits in a 20s SQS long
 * poll, and a shared loop made every new upload wait for that poll to time out before
 * its job was published. Shutdown aborts the in-flight long poll.
 */
@Injectable()
export class DocumentProcessingRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new StructuredLogger(DocumentProcessingRuntime.name, 'api');
  private running = false;
  private loops: Promise<void>[] = [];
  private readonly shutdown = new AbortController();

  public readonly completionService: DocumentCompletionService;
  private readonly repository: DocumentsRepository;
  private readonly queries: DocumentsQueries;

  constructor(
    @Inject(DocumentsRepository) repoOrDb: DocumentsRepository | DrizzleDb | PGlite,
    @Inject(INGESTION_QUEUE_TOKEN) public readonly ingestionQueue: IJobQueue,
    @Inject(COMPLETION_QUEUE_TOKEN) public readonly completionQueue: IJobQueue,
    completionService?: DocumentCompletionService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(DocumentsQueries) queries?: DocumentsQueries,
  ) {
    if (repoOrDb instanceof DocumentsRepository) {
      this.repository = repoOrDb;
      this.queries = queries ?? new DocumentsQueries(repoOrDb.getDb());
    } else {
      this.repository = new DocumentsRepository(repoOrDb);
      this.queries = queries ?? new DocumentsQueries(this.repository.getDb());
    }
    this.completionService =
      completionService instanceof DocumentCompletionService
        ? completionService
        : new DocumentCompletionService(this.repository);
  }

  public onModuleInit(): void {
    const consumerEnabled =
      this.configService?.get<string>('DOCUMENT_PROCESSING_CONSUMER_ENABLED');
    if (consumerEnabled === 'false') {
      this.logger.warn('Document processing consumer is disabled by configuration.');
      return;
    }

    this.running = true;
    this.loops = [this.runOutboxPublisher(), this.runCompletionConsumer()];
  }

  public async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.shutdown.abort();
    await Promise.all(this.loops);
  }

  /**
   * Transactional Outbox Publisher: reads pending outbox records every second and
   * enqueues them to the Ingestion Queue. NestJS is strictly the PRODUCER of the
   * Ingestion Queue; it NEVER consumes it.
   */
  private async runOutboxPublisher(): Promise<void> {
    while (this.running) {
      try {
        await this.publishPendingOutboxMessages();
      } catch (error) {
        this.logger.error(
          'Outbox publisher loop encountered an error; worker remains healthy.',
          error,
        );
      }
      await this.pause(POLL_INTERVAL_MS);
    }
  }

  /**
   * Dedicated Completion Queue Consumer: long-polls for DocumentExtractionCompletedEvent
   * published by Python and handles each as soon as it arrives. NestJS is strictly the
   * CONSUMER of the Completion Queue.
   */
  private async runCompletionConsumer(): Promise<void> {
    while (this.running) {
      try {
        const [completionMsg] = await this.completionQueue.receiveMessages(
          1,
          VISIBILITY_TIMEOUT_SECONDS,
          { abortSignal: this.shutdown.signal },
        );
        if (completionMsg) {
          await this.processCompletionMessage(completionMsg);
          continue;
        }
      } catch (error) {
        if (!this.running) break;
        this.logger.error(
          'Completion consumer loop encountered an error; worker remains healthy.',
          error,
        );
      }
      // Real SQS already waited in a long poll; this keeps instant-return queues from spinning.
      await this.pause(POLL_INTERVAL_MS);
    }
  }

  /** Sleeps up to ms, waking early on shutdown. */
  private pause(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.shutdown.signal.aborted) return resolve();
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.shutdown.signal.addEventListener('abort', done, { once: true });
    });
  }

  /**
   * Publishes pending outbox messages to the Ingestion Queue.
   * Employs optimistic leases to ensure at-least-once durable publishing across replicas.
   */
  public async publishPendingOutboxMessages(): Promise<void> {
    const now = new Date();
    const staleLease = new Date(now.getTime() - OUTBOX_LEASE_MS);
    const pending = await this.queries.findPendingOutboxMessages(now, staleLease, 10);

    for (const record of pending) {
      const claimed = await this.repository.claimOutboxMessage(record.id, now, staleLease);
      if (!claimed) continue;

      const message = record.payload as IngestionJobMessage;
      try {
        await this.ingestionQueue.enqueue(message);
        await this.repository.markOutboxPublished(record.id, new Date());

        this.logger.info(
          'outbox.message.published',
          `Published outbox job ${record.id} (doc: ${record.documentId}) to Ingestion Queue.`,
          { outboxId: record.id, documentId: record.documentId },
        );
      } catch (error) {
        const attempts = record.attempts + 1;
        const retrySeconds = Math.min(5 * 2 ** Math.min(attempts - 1, 6), 300);
        const messageText = error instanceof Error ? error.message : String(error);
        await this.repository.markOutboxFailed(
          record.id,
          attempts,
          messageText,
          new Date(Date.now() + retrySeconds * 1000),
        );
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
            if (event.documentId && event.organizationId) {
              try {
                await this.repository.updateDocumentStatus(
                  event.documentId,
                  event.organizationId,
                  {
                    status: 'FAILED',
                    lastProcessingError:
                      'Malformed completion message missing required identifiers (documentId, bidId, or organizationId).',
                    processingCompletedAt: new Date(),
                  },
                );
              } catch (dbErr) {
                this.logger.error(
                  `Failed to mark malformed doc ${event.documentId} as FAILED`,
                  dbErr,
                );
              }
            }
            await this.completionQueue.moveToDeadLetter(
              event as unknown as IngestionJobMessage,
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
            const dlqReason = `Exceeded max attempts (${MAX_PROCESSING_ATTEMPTS}): ${errorMessage}`;
            if (event.documentId && event.organizationId) {
              try {
                await this.repository.markDocumentFailed({
                  documentId: event.documentId,
                  organizationId: event.organizationId,
                  bidId: event.bidId || '',
                  error: dlqReason,
                  now: new Date(),
                });
              } catch (dbErr) {
                this.logger.error(
                  `Failed to update tender document status to FAILED for doc ${event.documentId}`,
                  dbErr,
                );
              }
            }
            await this.completionQueue.moveToDeadLetter(
              event as unknown as IngestionJobMessage,
              dlqReason,
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
