/**
 * DocumentsModule — Document upload, download, and extraction feature module.
 */
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import {
  DOCUMENT_EXTRACTOR_TOKEN,
  DocumentProcessingRuntime,
} from './DocumentProcessingRuntime.js';
import { AiDocumentExtractor } from '../bids/application/AiDocumentExtractor.js';
import { DocumentContentNormalizer } from '../bids/application/DocumentContentNormalizer.js';
import { STORAGE_TOKEN } from '../../infrastructure/storage/storage.module.js';
import type { IStorageService } from '../bids/application/IStorageService.js';

import { CompletionWebhookController } from './CompletionWebhookController.js';
import { DocumentCompletionService } from './DocumentCompletionService.js';

@Module({
  controllers: [DocumentsController, CompletionWebhookController],
  providers: [
    DocumentsService,
    DocumentCompletionService,
    {
      provide: DOCUMENT_EXTRACTOR_TOKEN,
      useFactory: (storage: IStorageService) => {
        const aiBaseUrl = process.env.AI_ENGINE_URL
        if (process.env.NODE_ENV === 'production' && !aiBaseUrl) {
          throw new Error('AI_ENGINE_URL must be configured in production.');
        }
        return new AiDocumentExtractor(storage, new DocumentContentNormalizer(), {
          aiBaseUrl: aiBaseUrl ?? 'http://localhost:8000',
          internalServiceKey: process.env.INTERNAL_SERVICE_KEY,
        });
      },
      inject: [STORAGE_TOKEN],
    },
    DocumentProcessingRuntime,
  ],
  exports: [DocumentsService, DocumentCompletionService],
})
export class DocumentsModule { }
