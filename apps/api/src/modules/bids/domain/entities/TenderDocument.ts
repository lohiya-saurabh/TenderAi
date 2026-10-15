import { AggregateRoot } from '@/common/domain/AggregateRoot.js';
import { ValidationException } from '@/common/domain/DomainException.js';
import { DocumentStatus } from '@/modules/bids/domain/value-objects/DocumentStatus.js';
import { TenderDocumentUploadedEvent } from '@/modules/bids/domain/events/TenderDocumentUploadedEvent.js';

export type DocumentType =
  'NIT' | 'RFP' | 'TECHNICAL_SPECS' | 'GCC' | 'SCC' | 'BOQ' | 'CORRIGENDUM' | 'OTHER';

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

export const MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export interface CreateTenderDocumentProps {
  id: string;
  bidId: string;
  organizationId: string;
  documentType: DocumentType;
  fileName: string;
  storagePath?: string;
  s3Key?: string; // Legacy alias for storagePath
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  status?: DocumentStatus;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TenderDocument extends AggregateRoot {
  private readonly _bidId: string;
  private readonly _organizationId: string;
  private readonly _documentType: DocumentType;
  private readonly _fileName: string;
  private readonly _storagePath: string;
  private readonly _sizeBytes: number;
  private readonly _mimeType: string;
  private readonly _checksumSha256: string;
  private _status: DocumentStatus;

  constructor(props: CreateTenderDocumentProps) {
    super(props.id, props.version ?? 1, props.createdAt, props.updatedAt);

    if (!props.bidId || props.bidId.trim() === '') {
      throw new ValidationException('Bid ID is mandatory for document.');
    }
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new ValidationException('Organization ID is mandatory for document.');
    }
    if (!props.fileName || props.fileName.trim() === '') {
      throw new ValidationException('File name cannot be empty.');
    }
    const resolvedPath = props.storagePath || props.s3Key;
    if (!resolvedPath || resolvedPath.trim() === '') {
      throw new ValidationException('Storage path cannot be empty.');
    }
    if (!props.sizeBytes || props.sizeBytes <= 0) {
      throw new ValidationException('File size must be greater than 0 bytes.');
    }
    if (props.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new ValidationException(
        `File size exceeds maximum allowed limit of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB.`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(props.mimeType)) {
      throw new ValidationException(`Unsupported document MIME type '${props.mimeType}'.`);
    }
    if (!/^[a-f0-9]{64}$/i.test(props.checksumSha256)) {
      throw new ValidationException('Checksum must be a valid 64-character SHA-256 hex string.');
    }

    this._bidId = props.bidId;
    this._organizationId = props.organizationId;
    this._documentType = props.documentType;
    this._fileName = props.fileName.trim();
    this._storagePath = resolvedPath.trim();
    this._sizeBytes = props.sizeBytes;
    this._mimeType = props.mimeType;
    this._checksumSha256 = props.checksumSha256.toLowerCase();
    this._status = props.status ?? DocumentStatus.PENDING_UPLOAD;
  }

  public get bidId(): string {
    return this._bidId;
  }

  public get organizationId(): string {
    return this._organizationId;
  }

  public get documentType(): DocumentType {
    return this._documentType;
  }

  public get fileName(): string {
    return this._fileName;
  }

  public get storagePath(): string {
    return this._storagePath;
  }

  /**
   * @deprecated Use `storagePath` instead for cloud-agnostic code.
   */
  public get s3Key(): string {
    return this._storagePath;
  }

  public get sizeBytes(): number {
    return this._sizeBytes;
  }

  public get mimeType(): string {
    return this._mimeType;
  }

  public get checksumSha256(): string {
    return this._checksumSha256;
  }

  public get status(): DocumentStatus {
    return this._status;
  }

  public markVerified(): void {
    this._status = this._status.transitionTo(DocumentStatus.VERIFIED);
    this.incrementVersion();

    this.addDomainEvent(
      new TenderDocumentUploadedEvent(
        this.id,
        this._organizationId,
        {
          documentId: this.id,
          bidId: this._bidId,
          documentType: this._documentType,
          fileName: this._fileName,
          sizeBytes: this._sizeBytes,
          mimeType: this._mimeType,
          checksumSha256: this._checksumSha256,
          status: this._status.value,
        },
        this.version,
      ),
    );
  }

  public markFailed(): void {
    this._status = this._status.transitionTo(DocumentStatus.FAILED);
    this.incrementVersion();
  }
}
