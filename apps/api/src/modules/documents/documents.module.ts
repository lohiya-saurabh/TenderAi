/**
 * DocumentsModule — Document upload, download, and extraction feature module.
 */
import { Module } from '@nestjs/common';
import { DocumentsController } from '@/modules/documents/documents.controller.js';
import { DocumentsService } from '@/modules/documents/documents.service.js';
import { DocumentProcessingRuntime } from '@/modules/documents/DocumentProcessingRuntime.js';
import {
  INGESTION_QUEUE_TOKEN,
  COMPLETION_QUEUE_TOKEN,
} from '@/infrastructure/queue/queue.module.js';
import type { IJobQueue } from '@/modules/bids/application/IJobQueue.js';
import { DRIZZLE_TOKEN, type DrizzleDb } from '@/common/database/database.module.js';

import { CompletionWebhookController } from '@/modules/documents/CompletionWebhookController.js';
import { DocumentCompletionService } from '@/modules/documents/DocumentCompletionService.js';

@Module({
  controllers: [DocumentsController, CompletionWebhookController],
  providers: [
    DocumentsService,
    DocumentCompletionService,
    {
      provide: DocumentProcessingRuntime,
      useFactory: (
        db: DrizzleDb,
        ingestionQueue: IJobQueue,
        completionQueue: IJobQueue,
        completionService: DocumentCompletionService,
      ) => {
        return new DocumentProcessingRuntime(db, ingestionQueue, completionQueue, completionService);
      },
      inject: [
        DRIZZLE_TOKEN,
        INGESTION_QUEUE_TOKEN,
        COMPLETION_QUEUE_TOKEN,
        DocumentCompletionService,
      ],
    },
  ],
  exports: [DocumentsService, DocumentCompletionService, DocumentProcessingRuntime],
})
export class DocumentsModule {}
