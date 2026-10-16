import { DomainEvent } from '@/common/domain/DomainEvent.js';

export interface BidProjectCreatedPayload {
  bidId: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: string;
  status: string;
}

export class BidProjectCreatedEvent extends DomainEvent<BidProjectCreatedPayload> {
  public static readonly EVENT_TYPE = 'tenderpulse.bids.project-created.v1';

  constructor(
    bidId: string,
    organizationId: string,
    payload: BidProjectCreatedPayload,
    version = 1,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(
      BidProjectCreatedEvent.EVENT_TYPE,
      bidId,
      'BidProject',
      organizationId,
      payload,
      version,
      eventId,
      occurredAt,
    );
  }
}
