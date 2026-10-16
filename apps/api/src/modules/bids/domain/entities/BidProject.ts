import { AggregateRoot } from '@/common/domain/AggregateRoot.js';
import { ValidationException } from '@/common/domain/DomainException.js';
import { BidStatus } from '@/modules/bids/domain/value-objects/BidStatus.js';
import { Money } from '@/modules/bids/domain/value-objects/Money.js';
import { BidProjectCreatedEvent } from '@/modules/bids/domain/events/BidProjectCreatedEvent.js';

export interface CreateBidProjectProps {
  id: string;
  organizationId: string;
  companyId?: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValue: Money;
  submissionDeadline: Date;
  status?: BidStatus;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BidProject extends AggregateRoot {
  private readonly _organizationId: string;
  private readonly _companyId: string;
  private _title: string;
  private _tenderNumber: string;
  private _tenderingAuthority: string;
  private _estimatedValue: Money;
  private _submissionDeadline: Date;
  private _status: BidStatus;

  constructor(props: CreateBidProjectProps) {
    super(props.id, props.version ?? 1, props.createdAt, props.updatedAt);

    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new ValidationException('Organization ID is mandatory.');
    }
    if (!props.title || props.title.trim() === '') {
      throw new ValidationException('Bid title cannot be empty.');
    }
    if (!props.tenderNumber || props.tenderNumber.trim() === '') {
      throw new ValidationException('Tender number cannot be empty.');
    }
    if (!props.tenderingAuthority || props.tenderingAuthority.trim() === '') {
      throw new ValidationException('Tendering authority cannot be empty.');
    }

    this._organizationId = props.organizationId;
    this._companyId = props.companyId || 'comp_default';
    this._title = props.title.trim();
    this._tenderNumber = props.tenderNumber.trim();
    this._tenderingAuthority = props.tenderingAuthority.trim();
    this._estimatedValue = props.estimatedValue;
    this._submissionDeadline = props.submissionDeadline;
    this._status = props.status ?? BidStatus.DRAFT;

    if (!props.status || props.status.equals(BidStatus.DRAFT)) {
      this.addDomainEvent(
        new BidProjectCreatedEvent(
          this.id,
          this._organizationId,
          {
            bidId: this.id,
            title: this._title,
            tenderNumber: this._tenderNumber,
            tenderingAuthority: this._tenderingAuthority,
            estimatedValueRupees: this._estimatedValue.toRupees(),
            submissionDeadline: this._submissionDeadline.toISOString(),
            status: this._status.value,
          },
          this.version,
        ),
      );
    }
  }

  public get organizationId(): string {
    return this._organizationId;
  }

  public get companyId(): string {
    return this._companyId;
  }

  public get title(): string {
    return this._title;
  }

  public get tenderNumber(): string {
    return this._tenderNumber;
  }

  public get tenderingAuthority(): string {
    return this._tenderingAuthority;
  }

  public get estimatedValue(): Money {
    return this._estimatedValue;
  }

  public get submissionDeadline(): Date {
    return this._submissionDeadline;
  }

  public get status(): BidStatus {
    return this._status;
  }

  public markQueued(): void {
    this._status = this._status.transitionTo(BidStatus.QUEUED);
    this.incrementVersion();
  }

  public markProcessing(): void {
    this._status = this._status.transitionTo(BidStatus.PROCESSING);
    this.incrementVersion();
  }

  public markReviewReady(): void {
    this._status = this._status.transitionTo(BidStatus.REVIEW_READY);
    this.incrementVersion();
  }

  public markFinalized(): void {
    this._status = this._status.transitionTo(BidStatus.FINALIZED);
    this.incrementVersion();
  }

  public markFailed(): void {
    this._status = this._status.transitionTo(BidStatus.FAILED);
    this.incrementVersion();
  }
}
