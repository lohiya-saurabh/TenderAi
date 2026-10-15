import { v4 as uuidv4 } from 'uuid';
import { IAuditRepository } from '@/modules/audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '@/modules/audit/domain/entities/AuditLog.js';
import {
  EntityNotFoundException,
  ValidationException,
} from '@/common/domain/DomainException.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { Permissions } from '@/common/security/permissions.js';
import { IBidRepository } from '@/modules/bids/domain/repositories/IBidRepository.js';
import { ITenderDocumentRepository } from '@/modules/bids/domain/repositories/ITenderDocumentRepository.js';
import { IIngestionJobRepository } from '@/modules/bids/domain/repositories/IIngestionJobRepository.js';
import { IStorageService } from '@/modules/bids/application/IStorageService.js';
import { IJobQueue } from '@/modules/bids/application/IJobQueue.js';
import { IEventBus } from '@/common/events/IEventBus.js';
import { IUnitOfWork, DirectUnitOfWork } from '@/common/database/IUnitOfWork.js';
import { BidStatus } from '@/modules/bids/domain/value-objects/BidStatus.js';
import { IngestionJob } from '@/modules/bids/domain/entities/IngestionJob.js';

export interface ConfirmDocumentUploadCommand {
  organizationId: string;
  userId: string;
  bidId: string;
  documentId: string;
}

export interface ConfirmDocumentUploadResult {
  documentId: string;
  bidId: string;
  jobId: string;
  documentStatus: string;
  bidStatus: string;
  version: number;
}

export class ConfirmDocumentUploadUseCase {
  constructor(
    private readonly bidRepository: IBidRepository,
    private readonly documentRepository: ITenderDocumentRepository,
    private readonly storageService: IStorageService,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork = new DirectUnitOfWork(),
    private readonly jobRepository?: IIngestionJobRepository,
    private readonly jobQueue?: IJobQueue,
    private readonly eventBus?: IEventBus,
  ) {}

  public async execute(
    command: ConfirmDocumentUploadCommand,
  ): Promise<ConfirmDocumentUploadResult> {
    // 1. RBAC Authorization check
    TenantContextHolder.requirePermission(Permissions.DOCUMENTS_UPLOAD);

    // 2. Anti-IDOR: Scoped lookup of Bid
    const bid = await this.bidRepository.findById(command.bidId, command.organizationId);
    if (!bid) {
      throw new EntityNotFoundException('Bid', command.bidId);
    }

    // 3. Anti-IDOR: Scoped lookup of TenderDocument
    const document = await this.documentRepository.findById(
      command.documentId,
      command.organizationId,
    );
    if (!document) {
      throw new EntityNotFoundException('TenderDocument', command.documentId);
    }

    // 4. Invariant: Cross-resource ownership verification
    if (document.bidId !== bid.id) {
      throw new ValidationException('Document does not belong to the specified bid.');
    }

    // 5. Verification against S3 (OUTSIDE of database transaction!)
    const headResult = await this.storageService.headObject(document.s3Key);
    if (!headResult.exists) {
      throw new ValidationException(
        `File not found in storage at key '${document.s3Key}'. Direct upload must complete before confirmation.`,
      );
    }

    if (headResult.sizeBytes !== document.sizeBytes) {
      throw new ValidationException(
        `File size mismatch: Declared ${document.sizeBytes} bytes, but storage reports ${headResult.sizeBytes} bytes.`,
      );
    }

    // 6. State Machine Transitions & Optimistic Concurrency Control
    document.markVerified();

    const previousBidStatus = bid.status.value;
    if (bid.status.equals(BidStatus.DRAFT)) {
      bid.markQueued();
    }

    const jobId = uuidv4();

    // 7. Atomic transaction boundary for persistence
    await this.unitOfWork.withTransaction(async () => {
      await this.documentRepository.update(document);
      await this.bidRepository.update(bid);

      if (this.jobRepository) {
        const job = new IngestionJob({
          id: jobId,
          organizationId: command.organizationId,
          bidId: bid.id,
          documentId: document.id,
          status: 'PENDING',
        });
        await this.jobRepository.save(job);
      }

      await this.auditRepository.save(
        new AuditLog({
          id: uuidv4(),
          organizationId: command.organizationId,
          userId: command.userId,
          action: 'CONFIRM_DOCUMENT_UPLOAD',
          entityType: 'TenderDocument',
          entityId: document.id,
          diff: {
            bidId: bid.id,
            jobId,
            previousBidStatus,
            newBidStatus: bid.status.value,
            documentStatus: document.status.value,
            fileName: document.fileName,
          },
        }),
      );
    });

    // 8. Enqueue SQS message (OUTSIDE of database transaction, after commit!)
    if (this.jobQueue) {
      await this.jobQueue.enqueue({
        jobId,
        organizationId: command.organizationId,
        companyId: bid.companyId,
        bidId: bid.id,
        documentId: document.id,
        workflowRunId: `run-${jobId}`,
        correlationId: `corr-${jobId}`,
        storageReference: document.s3Key,
        documentType: document.documentType,
        fileName: document.fileName,
        timestamp: new Date().toISOString(),
      });
    }

    // 9. Dispatch domain events to EventBus (AFTER transaction commit!)
    if (this.eventBus) {
      const events = document.pullDomainEvents();
      await this.eventBus.publishBatch(events);
    }

    return {
      documentId: document.id,
      bidId: bid.id,
      jobId,
      documentStatus: document.status.value,
      bidStatus: bid.status.value,
      version: bid.version,
    };
  }
}
