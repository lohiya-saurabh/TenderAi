import { InvalidStateTransitionException } from '@/common/domain/DomainException.js';

export type ComplianceStatusEnum = 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';

export class ComplianceStatus {
  public static readonly PENDING = new ComplianceStatus('PENDING');
  public static readonly READY = new ComplianceStatus('READY');
  public static readonly FLAGGED = new ComplianceStatus('FLAGGED');
  public static readonly WAIVED = new ComplianceStatus('WAIVED');

  private static readonly VALID_VALUES: ComplianceStatusEnum[] = [
    'PENDING',
    'READY',
    'FLAGGED',
    'WAIVED',
  ];

  private readonly _value: ComplianceStatusEnum;

  private constructor(value: ComplianceStatusEnum) {
    this._value = value;
  }

  public static fromString(value: string): ComplianceStatus {
    const upper = value.toUpperCase() as ComplianceStatusEnum;
    if (!ComplianceStatus.VALID_VALUES.includes(upper)) {
      throw new InvalidStateTransitionException(
        'UNKNOWN',
        upper,
        `Invalid compliance status '${value}'. Allowed: [${ComplianceStatus.VALID_VALUES.join(', ')}]`,
      );
    }
    return new ComplianceStatus(upper);
  }

  public get value(): ComplianceStatusEnum {
    return this._value;
  }

  public equals(other: ComplianceStatus): boolean {
    return this._value === other.value;
  }

  public isResolved(): boolean {
    return this._value === 'READY' || this._value === 'WAIVED';
  }

  public toString(): string {
    return this._value;
  }
}
