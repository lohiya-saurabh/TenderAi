import { ValidationException } from '../../../../common/domain/DomainException.js';
import { ExtractedComplianceItemInput } from '../../application/BulkIngestComplianceUseCase.js';

export interface BulkIngestPayload {
  items: ExtractedComplianceItemInput[];
  workflowRunId?: string;
  correlationId?: string;
}

export class BulkIngestComplianceDto {
  public readonly items: ExtractedComplianceItemInput[];

  constructor(payload: Partial<BulkIngestPayload>) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new ValidationException('Field "items" must be a non-empty array of compliance items.');
    }

    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      if (!item) {
        throw new ValidationException(`Item at index ${i} is null or undefined.`);
      }
      if (!item.title || typeof item.title !== 'string') {
        throw new ValidationException(`Item at index ${i} must have a valid string "title".`);
      }
      if (!item.category || typeof item.category !== 'string') {
        throw new ValidationException(`Item at index ${i} must have a valid string "category".`);
      }
      if (!item.provenance || typeof item.provenance !== 'object') {
        throw new ValidationException(`Item at index ${i} must have a valid "provenance" object.`);
      }
      if (!item.executionRules || typeof item.executionRules !== 'object') {
        throw new ValidationException(
          `Item at index ${i} must have a valid "executionRules" object.`
        );
      }
    }

    this.items = payload.items;
  }
}
