import { v4 as uuidv4 } from 'uuid';
import { IUnitOfWork } from '../../../common/database/IUnitOfWork.js';
import {
  EntityNotFoundException,
  ValidationException,
} from '../../../common/domain/DomainException.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { IBidRepository } from '../../bids/domain/repositories/IBidRepository.js';
import { ComplianceItem } from '../domain/entities/ComplianceItem.js';
import { IComplianceItemRepository } from '../domain/repositories/IComplianceItemRepository.js';
import { BidStatus } from '../../bids/domain/value-objects/BidStatus.js';
import { ExecutionRules, ExecutionRulesProps } from '../domain/value-objects/ExecutionRules.js';
import { Provenance, ProvenanceProps } from '../domain/value-objects/Provenance.js';

export interface ExtractedComplianceItemInput {
  category: string;
  title: string;
  description: string;
  executionRules: ExecutionRulesProps;
  provenance: ProvenanceProps;
}

export interface BulkIngestComplianceCommand {
  bidId: string;
  organizationId: string;
  workerId: string;
  items: ExtractedComplianceItemInput[];
}

export interface BulkIngestComplianceResult {
  bidId: string;
  insertedCount: number;
  bidStatus: string;
}

export class BulkIngestComplianceUseCase {
  constructor(
    private readonly bidRepository: IBidRepository,
    private readonly complianceRepository: IComplianceItemRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  public async execute(command: BulkIngestComplianceCommand): Promise<BulkIngestComplianceResult> {
    if (!command.items || command.items.length === 0) {
      throw new ValidationException('Cannot ingest an empty list of compliance items.');
    }

    const bid = await this.bidRepository.findById(command.bidId, command.organizationId);
    if (!bid) {
      throw new EntityNotFoundException('BidProject', command.bidId);
    }

    // In a real flow, bid might be QUEUED or PROCESSING. In tests/MVP, allow DRAFT/QUEUED/PROCESSING.
    if (bid.status.value === 'FINALIZED') {
      throw new ValidationException(`Cannot ingest compliance items into a FINALIZED bid.`);
    }

    // Convert raw extracted inputs into validated domain entities & value objects
    const complianceItems = command.items.map((item) => {
      const executionRules = new ExecutionRules(item.executionRules);
      const provenance = new Provenance(item.provenance);

      return new ComplianceItem({
        id: uuidv4(),
        bidId: bid.id,
        organizationId: bid.organizationId,
        category: item.category,
        title: item.title,
        description: item.description,
        executionRules,
        provenance,
      });
    });

    // Execute atomic persistence in UnitOfWork
    await this.unitOfWork.execute(async () => {
      await this.complianceRepository.saveBatch(complianceItems);

      // Transition bid state to REVIEW_READY through proper lifecycle steps
      if (bid.status.equals(BidStatus.DRAFT)) {
        bid.markQueued();
      }
      if (bid.status.equals(BidStatus.QUEUED)) {
        bid.markProcessing();
      }
      bid.markReviewReady();
      await this.bidRepository.update(bid);

      await this.auditRepository.save(
        new AuditLog({
          id: uuidv4(),
          organizationId: bid.organizationId,
          userId: command.workerId,
          action: 'BULK_INGEST_COMPLIANCE',
          entityType: 'BidProject',
          entityId: bid.id,
          diff: {
            itemsCount: complianceItems.length,
            newStatus: bid.status.value,
          },
        })
      );
    });

    return {
      bidId: bid.id,
      insertedCount: complianceItems.length,
      bidStatus: bid.status.value,
    };
  }
}
