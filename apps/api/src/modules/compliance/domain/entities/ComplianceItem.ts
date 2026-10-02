import { AggregateRoot } from '../../../../common/domain/AggregateRoot.js';
import { ValidationException } from '../../../../common/domain/DomainException.js';
import { ComplianceStatus } from '../value-objects/ComplianceStatus.js';
import { ExecutionRules } from '../value-objects/ExecutionRules.js';
import { Provenance } from '../value-objects/Provenance.js';
import { ComplianceItemReviewedEvent } from '../events/ComplianceItemReviewedEvent.js';

export interface CreateComplianceItemProps {
  id: string;
  bidId: string;
  organizationId: string;
  category: string;
  title: string;
  description: string;
  executionRules: ExecutionRules;
  provenance: Provenance;
  status?: ComplianceStatus;
  userNotes?: string | null;
  assignedUserId?: string | null;
  version?: number;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ComplianceItem extends AggregateRoot {
  private readonly _bidId: string;
  private readonly _organizationId: string;
  private readonly _category: string;
  private readonly _title: string;
  private readonly _description: string;
  private readonly _executionRules: ExecutionRules;
  private readonly _provenance: Provenance;
  private _status: ComplianceStatus;
  private _userNotes: string | null;
  private _assignedUserId: string | null;
  private _reviewedAt: Date | null;

  constructor(props: CreateComplianceItemProps) {
    super(props.id, props.version ?? 1, props.createdAt, props.updatedAt);

    if (!props.bidId || props.bidId.trim() === '') {
      throw new ValidationException('Bid ID is mandatory.');
    }
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new ValidationException('Organization ID is mandatory.');
    }
    if (!props.title || props.title.trim() === '') {
      throw new ValidationException('Compliance title cannot be empty.');
    }
    if (!props.category || props.category.trim() === '') {
      throw new ValidationException('Category cannot be empty.');
    }

    this._bidId = props.bidId;
    this._organizationId = props.organizationId;
    this._category = props.category.trim();
    this._title = props.title.trim();
    this._description = props.description?.trim() ?? '';
    this._executionRules = props.executionRules;
    this._provenance = props.provenance;
    this._status = props.status ?? ComplianceStatus.PENDING;
    this._userNotes = props.userNotes ?? null;
    this._assignedUserId = props.assignedUserId ?? null;
    this._reviewedAt = props.reviewedAt ?? null;
  }

  public get bidId(): string {
    return this._bidId;
  }

  public get organizationId(): string {
    return this._organizationId;
  }

  public get category(): string {
    return this._category;
  }

  public get title(): string {
    return this._title;
  }

  public get description(): string {
    return this._description;
  }

  public get executionRules(): ExecutionRules {
    return this._executionRules;
  }

  public get provenance(): Provenance {
    return this._provenance;
  }

  public get status(): ComplianceStatus {
    return this._status;
  }

  public get userNotes(): string | null {
    return this._userNotes;
  }

  public get assignedUserId(): string | null {
    return this._assignedUserId;
  }

  public get reviewedAt(): Date | null {
    return this._reviewedAt;
  }

  public updateReview(
    newStatus: ComplianceStatus,
    notes?: string | null,
    assignedUserId?: string | null
  ): void {
    // If flagging or waiving, notes are mandatory to explain why
    if (
      (newStatus.equals(ComplianceStatus.FLAGGED) || newStatus.equals(ComplianceStatus.WAIVED)) &&
      (!notes || notes.trim() === '')
    ) {
      throw new ValidationException(
        `A note is mandatory when changing compliance status to '${newStatus.value}'.`
      );
    }

    const previousStatus = this._status.value;
    this._status = newStatus;
    if (notes !== undefined) {
      this._userNotes = notes ? notes.trim() : null;
    }
    if (assignedUserId !== undefined) {
      this._assignedUserId = assignedUserId;
    }
    this._reviewedAt = new Date();
    this.incrementVersion();

    this.addDomainEvent(
      new ComplianceItemReviewedEvent(
        this.id,
        this._organizationId,
        {
          itemId: this.id,
          bidId: this._bidId,
          reviewerUserId: this._assignedUserId ?? 'SYSTEM',
          previousStatus,
          newStatus: this._status.value,
          reviewedAt: this._reviewedAt.toISOString(),
        },
        this.version
      )
    );
  }
}
