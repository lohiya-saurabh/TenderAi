import { DomainEvent } from '../../../../common/domain/DomainEvent.js';

export interface ComplianceItemReviewedPayload {
  itemId: string;
  bidId: string;
  reviewerUserId: string;
  previousStatus: string;
  newStatus: string;
  reviewedAt: string;
}

export class ComplianceItemReviewedEvent extends DomainEvent<ComplianceItemReviewedPayload> {
  public static readonly EVENT_TYPE = 'tenderpulse.compliance.item-reviewed.v1';

  constructor(
    itemId: string,
    organizationId: string,
    payload: ComplianceItemReviewedPayload,
    version = 1,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(
      ComplianceItemReviewedEvent.EVENT_TYPE,
      itemId,
      'ComplianceItem',
      organizationId,
      payload,
      version,
      eventId,
      occurredAt,
    );
  }
}
