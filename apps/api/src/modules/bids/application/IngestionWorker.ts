import { v4 as uuidv4 } from 'uuid';
import { IJobQueue, QueueMessage, IngestionJobMessage } from './IJobQueue.js';
import { IIngestionJobRepository } from '../domain/repositories/IIngestionJobRepository.js';
import { IBidRepository } from '../domain/repositories/IBidRepository.js';
import { ITenderDocumentRepository } from '../domain/repositories/ITenderDocumentRepository.js';
import { IComplianceItemRepository } from '../../compliance/domain/repositories/IComplianceItemRepository.js';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import { ComplianceItem } from '../../compliance/domain/entities/ComplianceItem.js';
import {
  ExecutionRules,
  ExecutionRulesProps,
} from '../../compliance/domain/value-objects/ExecutionRules.js';
import { Provenance } from '../../compliance/domain/value-objects/Provenance.js';
import { TenderDocument } from '../domain/entities/TenderDocument.js';
import { BidStatus } from '../domain/value-objects/BidStatus.js';
import { IUnitOfWork, DirectUnitOfWork } from '../../../common/database/IUnitOfWork.js';
import { IEventBus } from '../../../common/events/IEventBus.js';
import { ComplianceIngestionCompletedEvent } from '../domain/events/ComplianceIngestionCompletedEvent.js';

import { SecurityContextDto } from '@tenderpulse/shared-types';

export interface ExtractedComplianceItem {
  category: string;
  title: string;
  description: string;
  executionRules: ExecutionRulesProps;
  provenance: {
    pageNumber: number;
    clauseReference: string;
    verbatimQuote: string;
    confidenceScore: number;
  };
}

export interface IDocumentExtractor {
  extract(
    document: TenderDocument,
    securityContext?: SecurityContextDto
  ): Promise<ExtractedComplianceItem[]>;
}

export class DefaultDocumentExtractor implements IDocumentExtractor {
  public async extract(
    _document: TenderDocument,
    _securityContext?: SecurityContextDto
  ): Promise<ExtractedComplianceItem[]> {
    return [
      {
        category: 'FINANCIAL',
        title: 'Earnest Money Deposit (EMD) Guarantee',
        description: 'Submission of Bank Guarantee or DD towards EMD.',
        executionRules: {
          stampPaperRequired: true,
          stampPaperDenominationInr: 100,
          notarizationRequired: true,
          udinRequired: false,
          signingAuthorityRank: 'Authorized Signatory',
        },
        provenance: {
          pageNumber: 12,
          clauseReference: 'NIT Clause 4.2',
          verbatimQuote: 'Bidder must submit EMD of INR 5,00,000 in the form of Bank Guarantee.',
          confidenceScore: 0.98,
        },
      },
      {
        category: 'TECHNICAL',
        title: 'Past Similar Works Certification',
        description: 'Completion of 3 similar civil works in past 5 financial years.',
        executionRules: {
          stampPaperRequired: false,
          notarizationRequired: false,
          udinRequired: true,
          signingAuthorityRank: 'Statutory Auditor / CA',
        },
        provenance: {
          pageNumber: 24,
          clauseReference: 'GCC Clause 18.1',
          verbatimQuote:
            'Bidder must have completed minimum 3 projects each costing not less than 40% of estimated tender value.',
          confidenceScore: 0.95,
        },
      },
    ];
  }
}

export interface WorkerProcessResult {
  processed: boolean;
  status?: string;
  reason?: string;
  jobId?: string;
  itemsCount?: number;
  error?: string;
  attempts?: number;
  backoffSeconds?: number;
}

export class IngestionWorker {
  constructor(
    private readonly jobQueue: IJobQueue,
    private readonly jobRepository: IIngestionJobRepository,
    private readonly bidRepository: IBidRepository,
    private readonly documentRepository: ITenderDocumentRepository,
    private readonly complianceRepository: IComplianceItemRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork = new DirectUnitOfWork(),
    private readonly extractor: IDocumentExtractor = new DefaultDocumentExtractor(),
    private readonly visibilityTimeoutSeconds = 300,
    private readonly workerId = 'worker-ingestion-1',
    private readonly eventBus?: IEventBus
  ) {}

  public async pollAndProcess(): Promise<WorkerProcessResult> {
    const messages = await this.jobQueue.receiveMessages(1, this.visibilityTimeoutSeconds);
    const [firstMessage] = messages;
    if (!firstMessage) {
      return { processed: false, reason: 'NO_MESSAGES' };
    }

    return this.processMessage(firstMessage);
  }

  public async processMessage(
    message: QueueMessage<IngestionJobMessage>
  ): Promise<WorkerProcessResult> {
    const { receiptHandle, body, receiveCount } = message;

    // 1. TRUSTED BACKEND RESOLUTION & ANTI-TAMPERING:
    // DO NOT trust the claims in the message. Query PostgreSQL using the message's reference IDs.
    const job = await this.jobRepository.findById(body.jobId, body.organizationId);
    if (!job) {
      // Invalid job or cross-tenant tampering attempt!
      await this.jobQueue.moveToDeadLetter(
        body,
        `SECURITY_VIOLATION: IngestionJob '${body.jobId}' not found for tenant '${body.organizationId}'`,
        receiveCount
      );
      await this.jobQueue.deleteMessage(receiptHandle);
      return {
        processed: false,
        reason: 'UNAUTHORIZED_JOB_NOT_FOUND',
      };
    }

    // Verify consistency between job claims and message claims
    if (job.bidId !== body.bidId || job.documentId !== body.documentId) {
      await this.jobQueue.moveToDeadLetter(
        body,
        `SECURITY_VIOLATION: Message references mismatch database job references`,
        receiveCount
      );
      await this.jobQueue.deleteMessage(receiptHandle);
      return {
        processed: false,
        reason: 'TAMPERED_MESSAGE_PAYLOAD',
      };
    }

    // 2. IDEMPOTENCY: Check if job is already COMPLETED
    if (job.status === 'COMPLETED') {
      // Duplicate delivery from SQS at-least-once mechanism!
      // Safely delete duplicate message and exit without re-running work
      await this.jobQueue.deleteMessage(receiptHandle);
      return {
        processed: true,
        status: 'ALREADY_COMPLETED',
        jobId: job.id,
      };
    }

    // 3. DOCUMENT & BID AUTHORIZATION (Backend Trusted State)
    const document = await this.documentRepository.findById(body.documentId, body.organizationId);
    if (
      !document ||
      document.organizationId !== body.organizationId ||
      document.bidId !== body.bidId
    ) {
      // Unauthorized document or cross-tenant scope violation!
      job.markDeadLetter('SECURITY_VIOLATION: Document does not exist or tenant mismatch');
      await this.jobRepository.update(job);
      await this.jobQueue.moveToDeadLetter(
        body,
        `SECURITY_VIOLATION: Unauthorized document '${body.documentId}' for tenant '${body.organizationId}'`,
        receiveCount
      );
      await this.jobQueue.deleteMessage(receiptHandle);
      return {
        processed: false,
        reason: 'UNAUTHORIZED_DOCUMENT',
      };
    }

    const bid = await this.bidRepository.findById(body.bidId, body.organizationId);
    if (!bid || bid.organizationId !== body.organizationId) {
      job.markDeadLetter('SECURITY_VIOLATION: Bid does not exist or tenant mismatch');
      await this.jobRepository.update(job);
      await this.jobQueue.moveToDeadLetter(
        body,
        `SECURITY_VIOLATION: Unauthorized bid '${body.bidId}' for tenant '${body.organizationId}'`,
        receiveCount
      );
      await this.jobQueue.deleteMessage(receiptHandle);
      return {
        processed: false,
        reason: 'UNAUTHORIZED_BID',
      };
    }

    // 4. LEASE CHECK / WORKER CRASH HANDLING
    if (job.status === 'PROCESSING' && !job.isLeaseExpired()) {
      // Another worker is actively executing this job and lease is valid
      return {
        processed: false,
        reason: 'JOB_CURRENTLY_LOCKED',
      };
    }

    // 5. CLAIM JOB EXECUTION (Start Processing)
    job.claim(this.visibilityTimeoutSeconds * 1000);
    if (bid.status.equals(BidStatus.QUEUED)) {
      bid.markProcessing();
    }
    await this.jobRepository.update(job);
    await this.bidRepository.update(bid);

    // 6. EXECUTE EXTRACTION PIPELINE
    const ephemeralBuffers: Array<Buffer | string> = [];
    try {
      // Derive SecurityContext strictly from trusted backend database records
      const securityContext: SecurityContextDto = {
        tenantId: bid.organizationId,
        userId: this.workerId,
        roles: ['ADMIN'],
        workflowRunId: `run-${job.id}-${Date.now()}`,
        allowedDocumentIds: [document.id],
        allowedSourceIds: ['s3_vault'],
        purpose: 'COMPLIANCE_EXTRACTION',
      };

      const extractedItems = await this.extractor.extract(document, securityContext);

      // Deterministic validation of extracted items
      for (const item of extractedItems) {
        if (!item.title || item.title.trim() === '') {
          throw new Error('Deterministic validation failed: item title cannot be empty.');
        }
        if (
          item.executionRules.stampPaperRequired &&
          (item.executionRules.stampPaperDenominationInr === null ||
            item.executionRules.stampPaperDenominationInr === undefined ||
            item.executionRules.stampPaperDenominationInr <= 0)
        ) {
          throw new Error(
            `Deterministic validation failed: invalid stamp paper denomination for '${item.title}'.`
          );
        }
        if (item.provenance.pageNumber < 1) {
          throw new Error(
            `Deterministic validation failed: page number must be >= 1 for '${item.title}'.`
          );
        }
        if (!item.provenance.verbatimQuote || item.provenance.verbatimQuote.trim() === '') {
          throw new Error(
            `Deterministic validation failed: verbatim quote cannot be empty for '${item.title}'.`
          );
        }
      }

      // Convert to ComplianceItem entities
      const complianceEntities = extractedItems.map((item) => {
        return new ComplianceItem({
          id: uuidv4(),
          bidId: bid.id,
          organizationId: bid.organizationId,
          category: item.category,
          title: item.title,
          description: item.description,
          executionRules: new ExecutionRules(item.executionRules),
          provenance: new Provenance({
            sourceDocumentId: document.id,
            sourceFileName: document.fileName,
            pageNumber: item.provenance.pageNumber,
            clauseReference: item.provenance.clauseReference,
            verbatimQuote: item.provenance.verbatimQuote,
            confidenceScore: item.provenance.confidenceScore,
          }),
        });
      });

      // State transitions
      bid.markReviewReady();
      job.markCompleted();

      // Atomic persistence
      await this.unitOfWork.withTransaction(async () => {
        await this.complianceRepository.saveBatch(complianceEntities);
        await this.bidRepository.update(bid);
        await this.jobRepository.update(job);
        await this.auditRepository.save(
          new AuditLog({
            id: uuidv4(),
            organizationId: bid.organizationId,
            userId: this.workerId,
            action: 'INGESTION_JOB_COMPLETED',
            entityType: 'IngestionJob',
            entityId: job.id,
            diff: {
              bidId: bid.id,
              documentId: document.id,
              extractedItemsCount: complianceEntities.length,
              bidStatus: bid.status.value,
              jobStatus: job.status,
            },
          })
        );
      });

      // 7. ACKNOWLEDGE & REMOVE SQS MESSAGE
      await this.jobQueue.deleteMessage(receiptHandle);

      // 8. DISPATCH DOMAIN EVENT (After commit & SQS delete)
      if (this.eventBus) {
        await this.eventBus.publish(
          new ComplianceIngestionCompletedEvent(
            job.id,
            bid.organizationId,
            {
              jobId: job.id,
              bidId: bid.id,
              documentId: document.id,
              itemsCount: complianceEntities.length,
              newBidStatus: bid.status.value,
              completedAt: new Date().toISOString(),
            },
            job.version
          )
        );
      }

      return {
        processed: true,
        status: 'COMPLETED',
        jobId: job.id,
        itemsCount: complianceEntities.length,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown worker processing error';
      job.markFailed(errorMessage);

      if (job.status === 'DEAD_LETTER') {
        // Exceeded max attempts: move to DLQ
        await this.jobRepository.update(job);
        await this.jobQueue.moveToDeadLetter(body, errorMessage, receiveCount);
        await this.jobQueue.deleteMessage(receiptHandle);

        return {
          processed: false,
          status: 'DEAD_LETTER',
          error: errorMessage,
          attempts: job.attemptCount,
        };
      } else {
        // Retryable: backoff visibility timeout in SQS
        await this.jobRepository.update(job);
        const backoffSeconds = Math.min(30 * Math.pow(2, job.attemptCount - 1), 900);
        await this.jobQueue.changeMessageVisibility(receiptHandle, backoffSeconds);

        return {
          processed: false,
          status: 'RETRY_SCHEDULED',
          error: errorMessage,
          attempts: job.attemptCount,
          backoffSeconds,
        };
      }
    } finally {
      // Safe cleanup of ephemeral resources / memory buffers
      ephemeralBuffers.length = 0;
    }
  }
}

