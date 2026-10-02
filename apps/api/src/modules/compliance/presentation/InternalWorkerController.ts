import { InternalServiceGuard } from '../../../common/security/InternalServiceGuard.js';
import {
  BulkIngestComplianceUseCase,
  BulkIngestComplianceResult,
} from '../application/BulkIngestComplianceUseCase.js';
import { BulkIngestComplianceDto, BulkIngestPayload } from './dto/BulkIngestComplianceDto.js';

export class InternalWorkerController {
  constructor(
    private readonly bulkIngestUseCase: BulkIngestComplianceUseCase,
    private readonly serviceGuard: InternalServiceGuard
  ) {}

  public async ingestBatch(
    authHeaderKey: string | undefined,
    organizationId: string,
    bidId: string,
    workerId: string,
    rawPayload: BulkIngestPayload
  ): Promise<BulkIngestComplianceResult> {
    this.serviceGuard.validate(authHeaderKey);
    const dto = new BulkIngestComplianceDto(rawPayload);

    return this.bulkIngestUseCase.execute({
      bidId,
      organizationId,
      workerId,
      items: dto.items,
    });
  }
}
