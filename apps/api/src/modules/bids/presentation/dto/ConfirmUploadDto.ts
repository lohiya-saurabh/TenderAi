import { ValidationException } from '../../../../common/domain/DomainException.js';

export interface ConfirmUploadPayload {
  documentId: string;
}

export class ConfirmUploadDto {
  public readonly documentId: string;

  constructor(payload: ConfirmUploadPayload) {
    if (!payload.documentId || payload.documentId.trim() === '') {
      throw new ValidationException('Document ID is required for confirmation.');
    }
    this.documentId = payload.documentId.trim();
  }
}
