import { InvalidStateTransitionException } from '../../../../common/domain/DomainException.js';

export type BidStatusEnum =
  | 'DRAFT'
  | 'QUEUED'
  | 'PROCESSING'
  | 'ANALYZING'
  | 'REVIEW_READY'
  | 'FINALIZED'
  | 'SUBMITTED'
  | 'ARCHIVED'
  | 'FAILED';

export class BidStatus {
  public static readonly DRAFT = new BidStatus('DRAFT');
  public static readonly QUEUED = new BidStatus('QUEUED');
  public static readonly PROCESSING = new BidStatus('PROCESSING');
  public static readonly ANALYZING = new BidStatus('ANALYZING');
  public static readonly REVIEW_READY = new BidStatus('REVIEW_READY');
  public static readonly FINALIZED = new BidStatus('FINALIZED');
  public static readonly SUBMITTED = new BidStatus('SUBMITTED');
  public static readonly ARCHIVED = new BidStatus('ARCHIVED');
  public static readonly FAILED = new BidStatus('FAILED');

  private static readonly VALID_TRANSITIONS: Record<BidStatusEnum, BidStatusEnum[]> = {
    DRAFT: ['QUEUED', 'PROCESSING', 'ANALYZING'],
    QUEUED: ['PROCESSING', 'ANALYZING', 'FAILED'],
    PROCESSING: ['REVIEW_READY', 'FAILED'],
    ANALYZING: ['REVIEW_READY', 'FAILED'],
    REVIEW_READY: ['FINALIZED', 'SUBMITTED', 'QUEUED', 'ANALYZING'], // 'QUEUED' allowed if user re-uploads revised tender package
    FAILED: ['QUEUED', 'ANALYZING', 'PROCESSING'], // retry
    FINALIZED: ['SUBMITTED', 'ARCHIVED'],
    SUBMITTED: ['ARCHIVED'],
    ARCHIVED: [],
  };

  private readonly _value: BidStatusEnum;

  private constructor(value: BidStatusEnum) {
    this._value = value;
  }

  public static fromString(value: string): BidStatus {
    const upper = value.toUpperCase() as BidStatusEnum;
    if (!(upper in BidStatus.VALID_TRANSITIONS)) {
      throw new InvalidStateTransitionException('UNKNOWN', upper, `Invalid status '${value}'`);
    }
    return new BidStatus(upper);
  }

  public get value(): BidStatusEnum {
    return this._value;
  }

  public canTransitionTo(target: BidStatus): boolean {
    const allowed = BidStatus.VALID_TRANSITIONS[this._value];
    return allowed.includes(target.value);
  }

  public transitionTo(target: BidStatus): BidStatus {
    if (!this.canTransitionTo(target)) {
      throw new InvalidStateTransitionException(
        this._value,
        target.value,
        `Allowed transitions from '${this._value}' are: [${BidStatus.VALID_TRANSITIONS[this._value].join(', ')}]`
      );
    }
    return target;
  }

  public equals(other: BidStatus): boolean {
    return this._value === other.value;
  }

  public toString(): string {
    return this._value;
  }
}
