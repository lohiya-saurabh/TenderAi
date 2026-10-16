import { InternalServiceGuard } from '@/common/security/InternalServiceGuard.js';
import {
  BulkIngestComplianceUseCase,
  BulkIngestComplianceResult,
  BulkIngestComplianceCommand,
} from '@/modules/compliance/application/BulkIngestComplianceUseCase.js';
import { BulkIngestComplianceDto, BulkIngestPayload } from '@/modules/compliance/presentation/dto/BulkIngestComplianceDto.js';

export class InternalWorkerController {
  constructor(
    private readonly bulkIngestUseCase: BulkIngestComplianceUseCase,
    private readonly serviceGuard: InternalServiceGuard,
  ) {}

  public async ingestBatch(
    authHeaderKey: string | undefined,
    organizationId: string,
    bidId: string,
    workerId: string,
    rawPayload: BulkIngestPayload,
  ): Promise<BulkIngestComplianceResult> {
    this.serviceGuard.validate(authHeaderKey);
    const dto = new BulkIngestComplianceDto(rawPayload);

    const command: BulkIngestComplianceCommand = {
      bidId,
      organizationId,
      workerId,
      workflowRunId: rawPayload.workflowRunId ?? `run-${Date.now()}`,
      correlationId: rawPayload.correlationId ?? `corr-${Date.now()}`,
      items: dto.items,
    };

    return this.bulkIngestUseCase.execute(command);
  }
}
