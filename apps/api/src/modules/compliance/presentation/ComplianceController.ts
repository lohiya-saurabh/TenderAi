import {
  ListComplianceItemsUseCase,
  ComplianceItemViewDto,
} from '@/modules/compliance/application/ListComplianceItemsUseCase.js';
import {
  ReviewComplianceItemUseCase,
  ReviewComplianceItemResult,
} from '@/modules/compliance/application/ReviewComplianceItemUseCase.js';
import {
  UpdateComplianceItemDto,
  UpdateComplianceItemPayload,
} from '@/modules/compliance/presentation/dto/UpdateComplianceItemDto.js';

export class ComplianceController {
  constructor(
    private readonly listComplianceItemsUseCase: ListComplianceItemsUseCase,
    private readonly reviewComplianceItemUseCase: ReviewComplianceItemUseCase,
  ) {}

  public async listItems(organizationId: string, bidId: string): Promise<ComplianceItemViewDto[]> {
    return this.listComplianceItemsUseCase.execute({
      organizationId,
      bidId,
    });
  }

  public async reviewItem(
    organizationId: string,
    userId: string,
    bidId: string,
    itemId: string,
    rawPayload: UpdateComplianceItemPayload,
  ): Promise<ReviewComplianceItemResult> {
    const dto = new UpdateComplianceItemDto(rawPayload);

    return this.reviewComplianceItemUseCase.execute({
      organizationId,
      userId,
      bidId,
      itemId,
      status: dto.status,
      notes: dto.notes,
      expectedVersion: dto.expectedVersion,
    });
  }
}
