import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type {
  DocumentExtractionCompletedEvent,
  ExtractedComplianceItemDto,
} from '@tenderpulse/shared-types';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';
import { DocumentsRepository } from './documents.repository.js';

export interface CompletionProcessResult {
  processed: boolean;
  status: string;
  documentId: string;
  bidId: string;
  itemsCount: number;
  reason?: string;
}

@Injectable()
export class DocumentCompletionService {
  private readonly logger = new StructuredLogger(DocumentCompletionService.name, 'api');
  private readonly repository: DocumentsRepository;

  constructor(
    @Inject(DocumentsRepository)
    repoOrDb: DocumentsRepository | DrizzleDb | PGlite,
  ) {
    this.repository =
      repoOrDb instanceof DocumentsRepository
        ? repoOrDb
        : new DocumentsRepository(repoOrDb);
  }

  public validateItems(items: ExtractedComplianceItemDto[]): void {
    for (const [index, item] of items.entries()) {
      if (!item.category?.trim() || !item.title?.trim()) {
        throw new Error(`Extraction item ${index} is missing category or title.`);
      }
      if (
        item.executionRules?.stampPaperRequired &&
        (!item.executionRules.stampPaperDenominationInr ||
          item.executionRules.stampPaperDenominationInr <= 0)
      ) {
        throw new Error(`Extraction item ${index} has an invalid stamp-paper denomination.`);
      }
      if (
        !Number.isInteger(item.provenance?.pageNumber) ||
        (item.provenance?.pageNumber ?? 0) < 1
      ) {
        throw new Error(`Extraction item ${index} has an invalid source page.`);
      }
      if (!item.provenance?.verbatimQuote?.trim()) {
        throw new Error(`Extraction item ${index} is missing its source quote.`);
      }
    }
  }

  public async processExtractionCompleted(
    event: DocumentExtractionCompletedEvent,
  ): Promise<CompletionProcessResult> {
    const parentContext = LoggingContextHolder.get();
    const traceId =
      event.traceId ||
      event.correlationId ||
      parentContext.traceId ||
      `trc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const correlationId = event.correlationId || traceId;

    return LoggingContextHolder.run(
      {
        traceId,
        correlationId,
        jobId: event.jobId,
        tenantId: event.organizationId,
        tenderId: event.bidId,
        documentId: event.documentId,
      },
      async () => {
        const startTime = performance.now();
        const now = new Date();
        this.logger.info(
          'extraction.completion_event.processing',
          `Processing extraction completion event for doc ${event.documentId} (bid: ${event.bidId}, status: ${event.status})`,
          {
            jobId: event.jobId,
            status: event.status,
            itemsCount: event.items?.length ?? 0,
          },
        );

        if (event.status === 'FAILED') {
          const result = await this.repository.markDocumentFailed({
            documentId: event.documentId,
            organizationId: event.organizationId,
            bidId: event.bidId,
            error: event.error,
            now,
          });

          if (!result.updated) {
            this.logger.warn(
              `Document ${event.documentId} (org: ${event.organizationId}) not found for failed extraction event. Dropping completion event.`,
            );
            return {
              processed: false,
              status: 'DROPPED',
              documentId: event.documentId,
              bidId: event.bidId,
              itemsCount: 0,
              reason: 'Document not found or ownership changed before completion persistence',
            };
          }

          return {
            processed: true,
            status: 'FAILED',
            documentId: event.documentId,
            bidId: event.bidId,
            itemsCount: 0,
          };
        }

        const items = event.items ?? [];
        this.validateItems(items);

        const { dropped } = await this.repository.completeExtraction({
          event,
          items,
          now,
        });

        if (dropped) {
          this.logger.warn(
            `Document ${event.documentId} or bid ${event.bidId} (org: ${event.organizationId}) not found or ownership changed before completion persistence. Dropping completion event.`,
          );
          return {
            processed: false,
            status: 'DROPPED',
            documentId: event.documentId,
            bidId: event.bidId,
            itemsCount: 0,
            reason: 'Document or bid not found or ownership changed before completion persistence',
          };
        }

        const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
        this.logger.info(
          'compliance.items.persisted',
          `Successfully persisted ${items.length} compliance items for doc ${event.documentId}. Bid ${event.bidId} transitioned to REVIEW_READY (${durationMs}ms).`,
          { itemsCount: items.length, documentId: event.documentId, bidId: event.bidId },
          { duration_ms: durationMs },
        );

        return {
          processed: true,
          status: 'COMPLETED',
          documentId: event.documentId,
          bidId: event.bidId,
          itemsCount: items.length,
        };
      },
    );
  }
}
