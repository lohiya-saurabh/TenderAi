import { ValidationException } from '@/common/domain/DomainException.js';

export interface UpdateComplianceItemPayload {
  status: string;
  notes?: string | null;
  expectedVersion: number;
}

export class UpdateComplianceItemDto {
  public readonly status: string;
  public readonly notes: string | null;
  public readonly expectedVersion: number;

  constructor(payload: Partial<UpdateComplianceItemPayload>) {
    if (!payload.status || typeof payload.status !== 'string') {
      throw new ValidationException('Field "status" is required.');
    }
    if (typeof payload.expectedVersion !== 'number' || payload.expectedVersion < 1) {
      throw new ValidationException('Field "expectedVersion" must be a positive integer.');
    }

    this.status = payload.status.trim().toUpperCase();
    this.notes = payload.notes ? payload.notes.trim() : null;
    this.expectedVersion = payload.expectedVersion;
  }
}
