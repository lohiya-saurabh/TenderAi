import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { DocumentExtractionCompletedEvent } from '@tenderpulse/shared-types';
import { Public } from '../../common/security/decorators/public.decorator.js';
import { InternalServiceGuard } from '../../common/security/InternalServiceGuard.js';
import { DocumentCompletionService, type CompletionProcessResult } from './DocumentCompletionService.js';

@Controller('api/v1/internal')
export class CompletionWebhookController {
  private readonly logger = new Logger(CompletionWebhookController.name);
  private readonly serviceGuard = new InternalServiceGuard();

  constructor(private readonly completionService: DocumentCompletionService) {}

  @Public()
  @Post('extraction-completed')
  @HttpCode(HttpStatus.OK)
  public async handleExtractionCompleted(
    @Headers('x-internal-service-key') internalServiceKey: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() payload: DocumentExtractionCompletedEvent,
  ): Promise<CompletionProcessResult> {
    const key = internalServiceKey || apiKey;
    this.serviceGuard.validate(key);

    this.logger.log(
      `Received extraction completion webhook for doc ${payload.documentId} (bid: ${payload.bidId}, status: ${payload.status})`,
    );

    return this.completionService.processExtractionCompleted(payload);
  }
}
