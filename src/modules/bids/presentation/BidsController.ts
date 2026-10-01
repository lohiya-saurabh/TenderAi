import { CreateBidUseCase, CreateBidResult } from '../application/CreateBidUseCase.js';
import { CreateBidDto, CreateBidPayload } from './dto/CreateBidDto.js';

export class BidsController {
  constructor(private readonly createBidUseCase: CreateBidUseCase) {}

  public async create(
    organizationId: string,
    userId: string,
    rawPayload: CreateBidPayload
  ): Promise<CreateBidResult> {
    const dto = new CreateBidDto(rawPayload);

    return this.createBidUseCase.execute({
      organizationId,
      userId,
      title: dto.title,
      tenderNumber: dto.tenderNumber,
      tenderingAuthority: dto.tenderingAuthority,
      estimatedValueRupees: dto.estimatedValueRupees,
      submissionDeadline: dto.submissionDeadline,
    });
  }
}
