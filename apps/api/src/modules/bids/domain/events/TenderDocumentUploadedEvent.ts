import { DomainEvent } from '@/common/domain/DomainEvent.js';
import { DocumentType } from '@/modules/bids/domain/entities/TenderDocument.js';

export interface TenderDocumentUploadedPayload {
  documentId: string;
  bidId: string;
  documentType: DocumentType;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  status: string;
}

export class TenderDocumentUploadedEvent extends DomainEvent<TenderDocumentUploadedPayload> {
  public static readonly EVENT_TYPE = 'tenderpulse.bids.document-uploaded.v1';

  constructor(
    documentId: string,
    organizationId: string,
    payload: TenderDocumentUploadedPayload,
    version = 1,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(
      TenderDocumentUploadedEvent.EVENT_TYPE,
      documentId,
      'TenderDocument',
      organizationId,
      payload,
      version,
      eventId,
      occurredAt,
    );
  }
}
