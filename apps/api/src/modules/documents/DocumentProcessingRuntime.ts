import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import type { SecurityContextDto } from '@tenderpulse/shared-types';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { QUEUE_TOKEN } from '../../infrastructure/queue/queue.module.js';
import { STORAGE_TOKEN } from '../../infrastructure/storage/storage.module.js';
import type { IJobQueue, IngestionJobMessage, QueueMessage } from '../bids/application/IJobQueue.js';
import type { IStorageService } from '../bids/application/IStorageService.js';
import type {
  DocumentExtractionPort,
  ExtractedComplianceItem,
} from '../bids/application/AiDocumentExtractor.js';
import type { DocumentType } from '../bids/domain/entities/TenderDocument.js';

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
  private readonly logger = new Logger(DocumentProcessingRuntime.name);
  private running = false;
  private loop: Promise<void> | undefined;

  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    @Inject(STORAGE_TOKEN) private readonly storage: IStorageService,
    @Inject(QUEUE_TOKEN) private readonly queue: IJobQueue,
    @Inject(DOCUMENT_EXTRACTOR_TOKEN) private readonly extractor: DocumentExtractionPort,
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
      const extractedItems = await this.extractor.extract(
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

      this.validateItems(extractedItems);
      await this.persistResults(body, source.bid.companyId, extractedItems);
    } catch (error) {
      await this.handleProcessingFailure(message, claimed[0]!.processingAttempts, error);
      return;
    } finally {
      clearInterval(visibilityHeartbeat);
    }

    // ACK follows committed persistence. A failed ACK leaves the document completed;
    // redelivery will observe that state and acknowledge without reprocessing.
    await this.queue.deleteMessage(receiptHandle);
  }

  private validateItems(items: ExtractedComplianceItem[]): void {
    for (const [index, item] of items.entries()) {
      if (!item.category?.trim() || !item.title?.trim()) {
        throw new Error(`Extraction item ${index} is missing category or title.`);
      }
      if (
        item.executionRules.stampPaperRequired &&
        (!item.executionRules.stampPaperDenominationInr ||
          item.executionRules.stampPaperDenominationInr <= 0)
      ) {
        throw new Error(`Extraction item ${index} has an invalid stamp-paper denomination.`);
      }
      if (!Number.isInteger(item.provenance.pageNumber) || item.provenance.pageNumber < 1) {
        throw new Error(`Extraction item ${index} has an invalid source page.`);
      }
      if (!item.provenance.verbatimQuote?.trim()) {
        throw new Error(`Extraction item ${index} is missing its source quote.`);
      }
    }
  }

  private async persistResults(
    message: IngestionJobMessage,
    companyId: string,
    items: ExtractedComplianceItem[],
  ): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [lockedBid] = await tx
        .select({
          id: schema.bids.id,
          companyId: schema.bids.companyId,
        })
        .from(schema.bids)
        .where(
          and(
            eq(schema.bids.id, message.bidId),
            eq(schema.bids.organizationId, message.organizationId),
            eq(schema.bids.companyId, companyId),
          ),
        )
        .for('update');
      const [lockedDocument] = await tx
        .select({ id: schema.tenderDocuments.id })
        .from(schema.tenderDocuments)
        .where(
          and(
            eq(schema.tenderDocuments.id, message.documentId),
            eq(schema.tenderDocuments.bidId, message.bidId),
            eq(schema.tenderDocuments.organizationId, message.organizationId),
          ),
        )
        .for('update');
      if (!lockedBid || !lockedDocument) {
        throw new Error('Document ownership changed or disappeared before result persistence.');
      }

      const existingDocumentItems = await tx
        .select({
          id: schema.complianceItems.id,
          category: schema.complianceItems.category,
          title: schema.complianceItems.title,
        })
        .from(schema.complianceItems)
        .where(
          and(
            eq(schema.complianceItems.bidId, message.bidId),
            eq(schema.complianceItems.organizationId, message.organizationId),
            sql`${schema.complianceItems.provenance}->>'documentId' = ${message.documentId}`,
          ),
        );
      const existingByRequirement = new Map(
        existingDocumentItems.map((existingItem) => [
          `${existingItem.category}:${existingItem.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`,
          existingItem.id,
        ]),
      );

      for (const item of items) {
        const normalizedTitle = item.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
        const requirementKey = `${item.category}:${normalizedTitle}`;
        const existingItemId = existingByRequirement.get(requirementKey);
        const itemId = `cmp-${createHash('sha256')
          .update(
            `${message.organizationId}:${companyId}:${message.bidId}:${message.documentId}:${item.category}:${normalizedTitle}`,
          )
          .digest('hex')
          .slice(0, 48)}`;
        const provenance = {
          documentId: message.documentId,
          sourceDocumentId: message.documentId,
          documentName: message.fileName ?? '',
          sourceFileName: message.fileName ?? '',
          pageNumber: item.provenance.pageNumber,
          sectionOrClause: item.provenance.clauseReference,
          clauseReference: item.provenance.clauseReference,
          verbatimQuote: item.provenance.verbatimQuote,
          confidenceScore: item.provenance.confidenceScore,
        };
        if (existingItemId) {
          await tx
            .update(schema.complianceItems)
            .set({
              companyId,
              provenance,
              workflowRunId: message.workflowRunId ?? message.jobId,
              correlationId: message.correlationId ?? message.jobId,
              updatedAt: now,
            })
            .where(eq(schema.complianceItems.id, existingItemId));
          continue;
        }

        await tx.insert(schema.complianceItems).values({
          id: itemId,
          bidId: message.bidId,
          organizationId: message.organizationId,
          companyId,
          category: item.category,
          title: item.title,
          description: item.description,
          status: item.category === 'EXECUTION' ? 'FLAGGED' : 'READY',
          humanReviewRequired: true,
          reviewNotes: `Extracted from document ${message.documentId}, page ${item.provenance.pageNumber}.`,
          version: 1,
          executionRules: item.executionRules,
          provenance,
          workflowRunId: message.workflowRunId ?? message.jobId,
          correlationId: message.correlationId ?? message.jobId,
          createdAt: now,
          updatedAt: now,
        });
      }

      const allBidItems = await tx
        .select({ category: schema.complianceItems.category })
        .from(schema.complianceItems)
        .where(
          and(
            eq(schema.complianceItems.bidId, message.bidId),
            eq(schema.complianceItems.organizationId, message.organizationId),
          ),
        );
      const totalRequirements = allBidItems.length;
      const flaggedRequirements = allBidItems.filter((item) => item.category === 'EXECUTION').length;

      await tx
        .update(schema.bids)
        .set({
          status: 'REVIEW_READY',
          totalRequirements,
          flaggedRequirements,
          approvedRequirements: totalRequirements - flaggedRequirements,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.bids.id, message.bidId),
            eq(schema.bids.organizationId, message.organizationId),
            eq(schema.bids.companyId, companyId),
          ),
        );

      await tx
        .update(schema.tenderDocuments)
        .set({
          status: 'COMPLETED',
          processingStartedAt: null,
          processingCompletedAt: now,
          lastProcessingError: null,
        })
        .where(
          and(
            eq(schema.tenderDocuments.id, message.documentId),
            eq(schema.tenderDocuments.organizationId, message.organizationId),
          ),
        );

      await tx.insert(schema.auditLogs).values({
        id: `aud-doc-process-${randomUUID()}`,
        bidId: message.bidId,
        organizationId: message.organizationId,
        userId: 'document-processing-worker',
        userName: 'Document Processing Worker',
        eventType: 'AI_INGESTION_COMPLETED',
        aggregateType: 'TenderDocument',
        aggregateId: message.documentId,
        payload: {
          companyId,
          jobId: message.jobId,
          workflowRunId: message.workflowRunId,
          correlationId: message.correlationId,
          extractedItemsCount: items.length,
        },
        timestamp: now,
      });
    });
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
