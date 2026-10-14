import { CreateBidUseCase, CreateBidResult } from '../application/CreateBidUseCase.js';
import {
  GenerateUploadUrlUseCase,
  GenerateUploadUrlResult,
} from '../application/GenerateUploadUrlUseCase.js';
import {
  ConfirmDocumentUploadUseCase,
  ConfirmDocumentUploadResult,
} from '../application/ConfirmDocumentUploadUseCase.js';
import {
  GetDocumentDownloadUrlUseCase,
  GetDocumentDownloadUrlResult,
} from '../application/GetDocumentDownloadUrlUseCase.js';
import { CreateBidDto, CreateBidPayload } from './dto/CreateBidDto.js';
import { GenerateUploadUrlDto, GenerateUploadUrlPayload } from './dto/GenerateUploadUrlDto.js';
import { ConfirmUploadDto, ConfirmUploadPayload } from './dto/ConfirmUploadDto.js';

export class BidsController {
  constructor(
    private readonly createBidUseCase: CreateBidUseCase,
    private readonly generateUploadUrlUseCase?: GenerateUploadUrlUseCase,
    private readonly confirmDocumentUploadUseCase?: ConfirmDocumentUploadUseCase,
    private readonly getDocumentDownloadUrlUseCase?: GetDocumentDownloadUrlUseCase,
  ) {}

  public async create(
    organizationId: string,
    userId: string,
    rawPayload: CreateBidPayload,
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

  public async generateUploadUrl(
    organizationId: string,
    userId: string,
    bidId: string,
    rawPayload: GenerateUploadUrlPayload,
  ): Promise<GenerateUploadUrlResult> {
    if (!this.generateUploadUrlUseCase) {
      throw new Error('GenerateUploadUrlUseCase not configured on BidsController.');
    }
    const dto = new GenerateUploadUrlDto(rawPayload);

    return this.generateUploadUrlUseCase.execute({
      organizationId,
      userId,
      bidId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      sizeBytes: dto.sizeBytes,
      mimeType: dto.mimeType,
      checksumSha256: dto.checksumSha256,
    });
  }

  public async confirmDocumentUpload(
    organizationId: string,
    userId: string,
    bidId: string,
    rawPayload: ConfirmUploadPayload,
  ): Promise<ConfirmDocumentUploadResult> {
    if (!this.confirmDocumentUploadUseCase) {
      throw new Error('ConfirmDocumentUploadUseCase not configured on BidsController.');
    }
    const dto = new ConfirmUploadDto(rawPayload);

    return this.confirmDocumentUploadUseCase.execute({
      organizationId,
      userId,
      bidId,
      documentId: dto.documentId,
    });
  }

  public async getDocumentDownloadUrl(
    organizationId: string,
    userId: string,
    bidId: string,
    documentId: string,
  ): Promise<GetDocumentDownloadUrlResult> {
    if (!this.getDocumentDownloadUrlUseCase) {
      throw new Error('GetDocumentDownloadUrlUseCase not configured on BidsController.');
    }

    return this.getDocumentDownloadUrlUseCase.execute({
      organizationId,
      userId,
      bidId,
      documentId,
    });
  }
}
