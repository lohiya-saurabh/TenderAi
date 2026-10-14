import { v4 as uuidv4 } from 'uuid';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import { ValidationException } from '../../../common/domain/DomainException.js';
import { TenantContextHolder } from '../../../common/security/TenantContext.js';
import { Permissions } from '../../../common/security/permissions.js';
import { BidProject } from '../domain/entities/BidProject.js';
import { IBidRepository } from '../domain/repositories/IBidRepository.js';
import { Money } from '../domain/value-objects/Money.js';
import { IEventBus } from '../../../common/events/IEventBus.js';
import { IUnitOfWork, DirectUnitOfWork } from '../../../common/database/IUnitOfWork.js';

export interface CreateBidCommand {
  organizationId: string;
  userId: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: Date;
}

export interface CreateBidResult {
  id: string;
  organizationId: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueFormatted: string;
  submissionDeadline: string;
  status: string;
  version: number;
}

export class CreateBidUseCase {
  constructor(
    private readonly bidRepository: IBidRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork = new DirectUnitOfWork(),
    private readonly eventBus?: IEventBus,
  ) {}

  public async execute(command: CreateBidCommand): Promise<CreateBidResult> {
    // 1. RBAC Authorization check
    TenantContextHolder.requirePermission(Permissions.BIDS_CREATE);

    // 2. Domain invariant validation
    if (command.submissionDeadline.getTime() <= Date.now()) {
      throw new ValidationException('Submission deadline must be strictly in the future.');
    }

    const money = Money.fromRupees(command.estimatedValueRupees);
    const bidId = uuidv4();

    const bid = new BidProject({
      id: bidId,
      organizationId: command.organizationId,
      title: command.title,
      tenderNumber: command.tenderNumber,
      tenderingAuthority: command.tenderingAuthority,
      estimatedValue: money,
      submissionDeadline: command.submissionDeadline,
    });

    // 3. Atomic transaction boundary for persistence
    await this.unitOfWork.withTransaction(async () => {
      await this.bidRepository.save(bid);

      await this.auditRepository.save(
        new AuditLog({
          id: uuidv4(),
          organizationId: command.organizationId,
          userId: command.userId,
          action: 'CREATE_BID',
          entityType: 'BidProject',
          entityId: bid.id,
          diff: {
            title: bid.title,
            tenderNumber: bid.tenderNumber,
            estimatedValueRupees: command.estimatedValueRupees,
          },
        }),
      );
    });

    if (this.eventBus) {
      const events = bid.pullDomainEvents();
      await this.eventBus.publishBatch(events);
    }

    return {
      id: bid.id,
      organizationId: bid.organizationId,
      title: bid.title,
      tenderNumber: bid.tenderNumber,
      tenderingAuthority: bid.tenderingAuthority,
      estimatedValueFormatted: money.formatIndian(),
      submissionDeadline: bid.submissionDeadline.toISOString(),
      status: bid.status.value,
      version: bid.version,
    };
  }
}
