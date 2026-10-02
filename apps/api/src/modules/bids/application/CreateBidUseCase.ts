import { v4 as uuidv4 } from 'uuid';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import { BidProject } from '../domain/entities/BidProject.js';
import { IBidRepository } from '../domain/repositories/IBidRepository.js';
import { Money } from '../domain/value-objects/Money.js';

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
    private readonly auditRepository: IAuditRepository
  ) {}

  public async execute(command: CreateBidCommand): Promise<CreateBidResult> {
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
      })
    );

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
