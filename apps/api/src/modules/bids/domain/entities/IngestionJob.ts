import { AggregateRoot } from '@/common/domain/AggregateRoot.js';
import { ValidationException } from '@/common/domain/DomainException.js';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';

export interface CreateIngestionJobProps {
  id: string;
  organizationId: string;
  bidId: string;
  documentId: string;
  status?: JobStatus;
  attemptCount?: number;
  maxAttempts?: number;
  lastError?: string | null;
  lockedUntil?: Date | null;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class IngestionJob extends AggregateRoot {
  private readonly _organizationId: string;
  private readonly _bidId: string;
  private readonly _documentId: string;
  private _status: JobStatus;
  private _attemptCount: number;
  private readonly _maxAttempts: number;
  private _lastError: string | null;
  private _lockedUntil: Date | null;

  constructor(props: CreateIngestionJobProps) {
    super(props.id, props.version ?? 1, props.createdAt, props.updatedAt);

    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new ValidationException('Organization ID is mandatory for ingestion job.');
    }
    if (!props.bidId || props.bidId.trim() === '') {
      throw new ValidationException('Bid ID is mandatory for ingestion job.');
    }
    if (!props.documentId || props.documentId.trim() === '') {
      throw new ValidationException('Document ID is mandatory for ingestion job.');
    }

    this._organizationId = props.organizationId;
    this._bidId = props.bidId;
    this._documentId = props.documentId;
    this._status = props.status ?? 'PENDING';
    this._attemptCount = props.attemptCount ?? 0;
    this._maxAttempts = props.maxAttempts ?? 3;
    this._lastError = props.lastError ?? null;
    this._lockedUntil = props.lockedUntil ?? null;
  }

  public get organizationId(): string {
    return this._organizationId;
  }

  public get bidId(): string {
    return this._bidId;
  }

  public get documentId(): string {
    return this._documentId;
  }

  public get status(): JobStatus {
    return this._status;
  }

  public get attemptCount(): number {
    return this._attemptCount;
  }

  public get maxAttempts(): number {
    return this._maxAttempts;
  }

  public get lastError(): string | null {
    return this._lastError;
  }

  public get lockedUntil(): Date | null {
    return this._lockedUntil;
  }

  public isLeaseExpired(): boolean {
    if (!this._lockedUntil) return true;
    return this._lockedUntil.getTime() <= Date.now();
  }

  public canRetry(): boolean {
    return this._attemptCount < this._maxAttempts && this._status !== 'COMPLETED';
  }

  public claim(leaseDurationMs = 300000): void {
    if (this._status === 'COMPLETED') {
      throw new ValidationException('Cannot claim already completed job.');
    }
    this._status = 'PROCESSING';
    this._attemptCount += 1;
    this._lockedUntil = new Date(Date.now() + leaseDurationMs);
    this.incrementVersion();
  }

  public markCompleted(): void {
    this._status = 'COMPLETED';
    this._lockedUntil = null;
    this._lastError = null;
    this.incrementVersion();
  }

  public markFailed(error: string): void {
    this._lastError = error;
    this._lockedUntil = null;
    if (this._attemptCount >= this._maxAttempts) {
      this._status = 'DEAD_LETTER';
    } else {
      this._status = 'FAILED';
    }
    this.incrementVersion();
  }

  public markDeadLetter(error: string): void {
    this._status = 'DEAD_LETTER';
    this._lastError = error;
    this._lockedUntil = null;
    this.incrementVersion();
  }
}
