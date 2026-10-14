import { DomainEvent } from '../../../../common/domain/DomainEvent.js';

export interface ComplianceIngestionCompletedPayload {
  jobId: string;
  bidId: string;
  documentId: string;
  itemsCount: number;
  newBidStatus: string;
  completedAt: string;
}

export class ComplianceIngestionCompletedEvent extends DomainEvent<ComplianceIngestionCompletedPayload> {
  public static readonly EVENT_TYPE = 'tenderpulse.compliance.ingestion-completed.v1';

  constructor(
    jobId: string,
    organizationId: string,
    payload: ComplianceIngestionCompletedPayload,
    version = 1,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(
      ComplianceIngestionCompletedEvent.EVENT_TYPE,
      jobId,
      'IngestionJob',
      organizationId,
      payload,
      version,
      eventId,
      occurredAt,
    );
  }
}
