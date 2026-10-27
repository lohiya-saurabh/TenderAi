import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsController } from '@/modules/documents/documents.controller.js';
import { DocumentsService } from '@/modules/documents/documents.service.js';
import { DocumentsRepository } from '@/modules/documents/documents.repository.js';
import { DocumentsQueries } from '@/modules/documents/documents.queries.js';
import { DocumentProcessingRuntime } from '@/modules/documents/DocumentProcessingRuntime.js';
import {
  INGESTION_QUEUE_TOKEN,
  COMPLETION_QUEUE_TOKEN,
} from '@/infrastructure/queue/queue.module.js';
import type { IJobQueue } from '@/modules/bids/application/IJobQueue.js';
import { CompletionWebhookController } from '@/modules/documents/CompletionWebhookController.js';
import { DocumentCompletionService } from '@/modules/documents/DocumentCompletionService.js';

@Module({
  controllers: [DocumentsController, CompletionWebhookController],
  providers: [
    DocumentsService,
    DocumentsRepository,
    DocumentsQueries,
    DocumentCompletionService,
    {
      provide: DocumentProcessingRuntime,
      useFactory: (
        repo: DocumentsRepository,
        ingestionQueue: IJobQueue,
        completionQueue: IJobQueue,
        completionService: DocumentCompletionService,
        configService: ConfigService,
        queries: DocumentsQueries,
      ) => {
        return new DocumentProcessingRuntime(
          repo,
          ingestionQueue,
          completionQueue,
          completionService,
          configService,
          queries,
        );
      },
      inject: [
        DocumentsRepository,
        INGESTION_QUEUE_TOKEN,
        COMPLETION_QUEUE_TOKEN,
        DocumentCompletionService,
        ConfigService,
        DocumentsQueries,
      ],
    },
  ],
  exports: [
    DocumentsService,
    DocumentsRepository,
    DocumentsQueries,
    DocumentCompletionService,
    DocumentProcessingRuntime,
  ],
})
export class DocumentsModule {}
