import { ValidationException } from '../../../../common/domain/DomainException.js';

export interface CreateBidPayload {
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: string;
}

export class CreateBidDto {
  public readonly title: string;
  public readonly tenderNumber: string;
  public readonly tenderingAuthority: string;
  public readonly estimatedValueRupees: number;
  public readonly submissionDeadline: Date;

  constructor(payload: Partial<CreateBidPayload>) {
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim() === '') {
      throw new ValidationException('Field "title" is required and must be a non-empty string.');
    }
    if (!payload.tenderNumber || typeof payload.tenderNumber !== 'string' || payload.tenderNumber.trim() === '') {
      throw new ValidationException('Field "tenderNumber" is required and must be a non-empty string.');
    }
    if (!payload.tenderingAuthority || typeof payload.tenderingAuthority !== 'string' || payload.tenderingAuthority.trim() === '') {
      throw new ValidationException('Field "tenderingAuthority" is required and must be a non-empty string.');
    }
    if (typeof payload.estimatedValueRupees !== 'number' || payload.estimatedValueRupees < 0) {
      throw new ValidationException('Field "estimatedValueRupees" must be a positive number.');
    }
    if (!payload.submissionDeadline || isNaN(Date.parse(payload.submissionDeadline))) {
      throw new ValidationException('Field "submissionDeadline" must be a valid ISO date string.');
    }

    this.title = payload.title.trim();
    this.tenderNumber = payload.tenderNumber.trim();
    this.tenderingAuthority = payload.tenderingAuthority.trim();
    this.estimatedValueRupees = payload.estimatedValueRupees;
    this.submissionDeadline = new Date(payload.submissionDeadline);
  }
}
