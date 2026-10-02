import { ValidationException } from '../../../../common/domain/DomainException.js';
import {
  DocumentType,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../../domain/entities/TenderDocument.js';

export interface GenerateUploadUrlPayload {
  documentType: DocumentType;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
}

export class GenerateUploadUrlDto {
  public readonly documentType: DocumentType;
  public readonly fileName: string;
  public readonly sizeBytes: number;
  public readonly mimeType: string;
  public readonly checksumSha256: string;

  constructor(payload: GenerateUploadUrlPayload) {
    if (!payload.documentType) {
      throw new ValidationException('Document type is required.');
    }
    if (!payload.fileName || payload.fileName.trim() === '') {
      throw new ValidationException('File name cannot be empty.');
    }
    if (typeof payload.sizeBytes !== 'number' || payload.sizeBytes <= 0) {
      throw new ValidationException('File size must be a positive number.');
    }
    if (payload.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new ValidationException(
        `File size exceeds maximum allowed limit of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB.`
      );
    }
    if (!payload.mimeType || !ALLOWED_MIME_TYPES.has(payload.mimeType)) {
      throw new ValidationException(`Unsupported document MIME type '${payload.mimeType}'.`);
    }
    if (!payload.checksumSha256 || !/^[a-f0-9]{64}$/i.test(payload.checksumSha256)) {
      throw new ValidationException('Checksum must be a valid 64-character SHA-256 hex string.');
    }

    this.documentType = payload.documentType;
    this.fileName = payload.fileName.trim();
    this.sizeBytes = payload.sizeBytes;
    this.mimeType = payload.mimeType;
    this.checksumSha256 = payload.checksumSha256.toLowerCase();
  }
}
