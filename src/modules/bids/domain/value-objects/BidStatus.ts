import { InvalidStateTransitionException } from '../../../../common/domain/DomainException.js';

export type BidStatusEnum =
  | 'DRAFT'
  | 'QUEUED'
  | 'PROCESSING'
  | 'REVIEW_READY'
  | 'FINALIZED'
  | 'FAILED';

export class BidStatus {
  public static readonly DRAFT = new BidStatus('DRAFT');
  public static readonly QUEUED = new BidStatus('QUEUED');
  public static readonly PROCESSING = new BidStatus('PROCESSING');
  public static readonly REVIEW_READY = new BidStatus('REVIEW_READY');
  public static readonly FINALIZED = new BidStatus('FINALIZED');
  public static readonly FAILED = new BidStatus('FAILED');

  private static readonly VALID_TRANSITIONS: Record<BidStatusEnum, BidStatusEnum[]> = {
    DRAFT: ['QUEUED'],
    QUEUED: ['PROCESSING', 'FAILED'],
    PROCESSING: ['REVIEW_READY', 'FAILED'],
    REVIEW_READY: ['FINALIZED', 'QUEUED'], // 'QUEUED' allowed if user re-uploads revised tender package
    FAILED: ['QUEUED'], // retry
    FINALIZED: [], // terminal state
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
