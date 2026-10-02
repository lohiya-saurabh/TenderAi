import { v4 as uuidv4 } from 'uuid';
import { IUnitOfWork } from '../../../common/database/IUnitOfWork.js';
import {
  ConcurrencyConflictException,
  EntityNotFoundException,
  UnauthorizedTenantAccessException,
} from '../../../common/domain/DomainException.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { IComplianceItemRepository } from '../domain/repositories/IComplianceItemRepository.js';
import { ComplianceStatus } from '../domain/value-objects/ComplianceStatus.js';
import { IEventBus } from '../../../common/events/IEventBus.js';

export interface ReviewComplianceItemCommand {
  organizationId: string;
  userId: string;
  bidId: string;
  itemId: string;
  status: string;
  notes?: string | null;
  expectedVersion: number;
}

export interface ReviewComplianceItemResult {
  id: string;
  bidId: string;
  organizationId: string;
  category: string;
  title: string;
  status: string;
  userNotes: string | null;
  assignedUserId: string | null;
  version: number;
  reviewedAt: string | null;
}

export class ReviewComplianceItemUseCase {
  constructor(
    private readonly complianceRepository: IComplianceItemRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus?: IEventBus
  ) {}

  public async execute(command: ReviewComplianceItemCommand): Promise<ReviewComplianceItemResult> {
    const item = await this.complianceRepository.findById(command.itemId, command.organizationId);
    if (!item) {
      throw new EntityNotFoundException('ComplianceItem', command.itemId);
    }

    if (item.bidId !== command.bidId) {
      throw new UnauthorizedTenantAccessException('Item does not belong to the specified bid.');
    }

    // Check Optimistic Concurrency Control
    if (item.version !== command.expectedVersion) {
      throw new ConcurrencyConflictException(
        'ComplianceItem',
        item.id,
        command.expectedVersion,
        item.version
      );
    }

    const previousStatus = item.status.value;
    const newStatus = ComplianceStatus.fromString(command.status);

    item.updateReview(newStatus, command.notes, command.userId);

    await this.unitOfWork.execute(async () => {
      await this.complianceRepository.update(item, command.expectedVersion);

      await this.auditRepository.save(
        new AuditLog({
          id: uuidv4(),
          organizationId: command.organizationId,
          userId: command.userId,
          action: 'REVIEW_COMPLIANCE_ITEM',
          entityType: 'ComplianceItem',
          entityId: item.id,
          diff: {
            previousStatus,
            newStatus: newStatus.value,
            notes: command.notes,
            version: item.version,
          },
        })
      );
    });

    if (this.eventBus) {
      const events = item.pullDomainEvents();
      await this.eventBus.publishBatch(events);
    }

    return {
      id: item.id,
      bidId: item.bidId,
      organizationId: item.organizationId,
      category: item.category,
      title: item.title,
      status: item.status.value,
      userNotes: item.userNotes,
      assignedUserId: item.assignedUserId,
      version: item.version,
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
    };
  }
}
