import { InvalidStateTransitionException } from '../../../../common/domain/DomainException.js';

export type DocumentStatusEnum = 'PENDING_UPLOAD' | 'VERIFIED' | 'FAILED' | 'PROCESSED';

export class DocumentStatus {
  public static readonly PENDING_UPLOAD = new DocumentStatus('PENDING_UPLOAD');
  public static readonly VERIFIED = new DocumentStatus('VERIFIED');
  public static readonly FAILED = new DocumentStatus('FAILED');
  public static readonly PROCESSED = new DocumentStatus('PROCESSED');

  private static readonly VALID_TRANSITIONS: Record<DocumentStatusEnum, DocumentStatusEnum[]> = {
    PENDING_UPLOAD: ['VERIFIED', 'FAILED'],
    VERIFIED: ['PROCESSED', 'FAILED'],
    FAILED: ['PENDING_UPLOAD'], // retry re-upload
    PROCESSED: [],
  };

  private readonly _value: DocumentStatusEnum;

  private constructor(value: DocumentStatusEnum) {
    this._value = value;
  }

  public static fromString(value: string): DocumentStatus {
    const upper = value.toUpperCase() as DocumentStatusEnum;
    if (!(upper in DocumentStatus.VALID_TRANSITIONS)) {
      throw new InvalidStateTransitionException(
        'UNKNOWN',
        upper,
        `Invalid document status '${value}'`,
      );
    }
    return new DocumentStatus(upper);
  }

  public get value(): DocumentStatusEnum {
    return this._value;
  }

  public canTransitionTo(target: DocumentStatus): boolean {
    const allowed = DocumentStatus.VALID_TRANSITIONS[this._value];
    return allowed.includes(target.value);
  }

  public transitionTo(target: DocumentStatus): DocumentStatus {
    if (!this.canTransitionTo(target)) {
      throw new InvalidStateTransitionException(
        this._value,
        target.value,
        `Allowed document transitions from '${this._value}' are: [${DocumentStatus.VALID_TRANSITIONS[this._value].join(', ')}]`,
      );
    }
    return target;
  }

  public equals(other: DocumentStatus): boolean {
    return this._value === other.value;
  }

  public toString(): string {
    return this._value;
  }
}
