import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { and, eq } from 'drizzle-orm';
import type {
  DocumentExtractionCompletedEvent,
  ExtractedComplianceItemDto,
} from '@tenderpulse/shared-types';
import { DRIZZLE_TOKEN, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';

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

  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

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
          const updated = await this.db
            .update(schema.tenderDocuments)
            .set({
              status: 'FAILED',
              processingStartedAt: null,
              processingCompletedAt: now,
              lastProcessingError: event.error || 'Document extraction failed in AI worker.',
            })
            .where(
              and(
                eq(schema.tenderDocuments.id, event.documentId),
                eq(schema.tenderDocuments.organizationId, event.organizationId),
              ),
            )
            .returning({ id: schema.tenderDocuments.id });

          if (updated.length === 0) {
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

          // Verify whether all tender documents for this bid have reached a terminal status
          const allBidDocs = await this.db
            .select({
              id: schema.tenderDocuments.id,
              status: schema.tenderDocuments.status,
            })
            .from(schema.tenderDocuments)
            .where(
              and(
                eq(schema.tenderDocuments.bidId, event.bidId),
                eq(schema.tenderDocuments.organizationId, event.organizationId),
              ),
            );

          const terminalStatuses = new Set(['COMPLETED', 'FAILED']);
          const allDocsTerminal =
            allBidDocs.length > 0 && allBidDocs.every((d) => terminalStatuses.has(d.status));

          if (allDocsTerminal) {
            await this.db
              .update(schema.bids)
              .set({
                status: 'REVIEW_READY',
                updatedAt: now,
              })
              .where(
                and(
                  eq(schema.bids.id, event.bidId),
                  eq(schema.bids.organizationId, event.organizationId),
                ),
              );
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

        let dropped = false;
        await this.db.transaction(async (tx) => {
          const [lockedBid] = await tx
            .select({
              id: schema.bids.id,
              companyId: schema.bids.companyId,
              organizationId: schema.bids.organizationId,
            })
            .from(schema.bids)
            .where(
              and(
                eq(schema.bids.id, event.bidId),
                eq(schema.bids.organizationId, event.organizationId),
              ),
            )
            .for('update');

          const [lockedDocument] = await tx
            .select({
              id: schema.tenderDocuments.id,
              fileName: schema.tenderDocuments.fileName,
            })
            .from(schema.tenderDocuments)
            .where(
              and(
                eq(schema.tenderDocuments.id, event.documentId),
                eq(schema.tenderDocuments.bidId, event.bidId),
                eq(schema.tenderDocuments.organizationId, event.organizationId),
              ),
            )
            .for('update');

          if (!lockedBid || !lockedDocument) {
            this.logger.warn(
              `Document ${event.documentId} or bid ${event.bidId} (org: ${event.organizationId}) not found or ownership changed before completion persistence. Dropping completion event.`,
            );
            dropped = true;
            return;
          }

          const effectiveCompanyId = event.companyId || lockedBid.companyId;

          const existingBidItems = await tx
            .select({
              id: schema.complianceItems.id,
              category: schema.complianceItems.category,
              title: schema.complianceItems.title,
              executionRules: schema.complianceItems.executionRules,
              provenance: schema.complianceItems.provenance,
            })
            .from(schema.complianceItems)
            .where(
              and(
                eq(schema.complianceItems.bidId, event.bidId),
                eq(schema.complianceItems.organizationId, event.organizationId),
              ),
            );

          const existingByRequirement = new Map(
            existingBidItems.map((existingItem) => [
              `${existingItem.category}:${existingItem.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`,
              existingItem,
            ]),
          );

          for (const item of items) {
            const normalizedTitle = item.title.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
            const requirementKey = `${item.category}:${normalizedTitle}`;
            const existingItem = existingByRequirement.get(requirementKey);
            const itemId = `cmp-${createHash('sha256')
              .update(
                `${event.organizationId}:${effectiveCompanyId}:${event.bidId}:${item.category}:${normalizedTitle}`,
              )
              .digest('hex')
              .slice(0, 48)}`;

            const newProvenance = {
              documentId: event.documentId,
              sourceDocumentId: event.documentId,
              documentName: lockedDocument.fileName,
              sourceFileName: lockedDocument.fileName,
              pageNumber: item.provenance.pageNumber,
              sectionOrClause: item.provenance.clauseReference,
              clauseReference: item.provenance.clauseReference,
              verbatimQuote: item.provenance.verbatimQuote,
              confidenceScore: item.provenance.confidenceScore ?? 0.95,
            };

            if (existingItem) {
              interface ExecutionRulesRecord {
                stampPaperRequired?: boolean;
                stampPaperDenominationInr?: number;
                notarizationRequired?: boolean;
                udinRequired?: boolean;
              }
              interface ProvenanceRecord {
                verbatimQuote?: string;
                confidenceScore?: number;
              }
              const exRules = (existingItem.executionRules ?? {}) as ExecutionRulesRecord;
              const mergedExecutionRules = {
                ...exRules,
                ...item.executionRules,
                stampPaperRequired: Boolean(
                  exRules.stampPaperRequired || item.executionRules?.stampPaperRequired,
                ),
                stampPaperDenominationInr:
                  Math.max(
                    exRules.stampPaperDenominationInr || 0,
                    item.executionRules?.stampPaperDenominationInr || 0,
                  ) || undefined,
                notarizationRequired: Boolean(
                  exRules.notarizationRequired || item.executionRules?.notarizationRequired,
                ),
                udinRequired: Boolean(exRules.udinRequired || item.executionRules?.udinRequired),
              };

              const exProv = (existingItem.provenance ?? {}) as ProvenanceRecord;
              const curQuote = item.provenance.verbatimQuote || '';
              const exQuote = exProv.verbatimQuote || '';
              const preferNewQuote =
                (!exQuote && Boolean(curQuote)) ||
                (exQuote.length < 50 && curQuote.length >= 50) ||
                ((item.provenance.confidenceScore || 0) > (exProv.confidenceScore || 0) &&
                  curQuote.length >= 40);

              const provenanceToSet = preferNewQuote ? newProvenance : existingItem.provenance;

              await tx
                .update(schema.complianceItems)
                .set({
                  companyId: effectiveCompanyId,
                  executionRules: mergedExecutionRules,
                  provenance: provenanceToSet,
                  workflowRunId: event.workflowRunId ?? event.jobId,
                  correlationId: event.correlationId ?? event.jobId,
                  updatedAt: now,
                })
                .where(eq(schema.complianceItems.id, existingItem.id));

              existingByRequirement.set(requirementKey, {
                ...existingItem,
                executionRules: mergedExecutionRules,
                provenance: provenanceToSet,
              });
              continue;
            }

            await tx.insert(schema.complianceItems).values({
              id: itemId,
              bidId: event.bidId,
              organizationId: event.organizationId,
              companyId: effectiveCompanyId,
              category: item.category,
              title: item.title,
              description: item.description ?? '',
              status: item.category === 'EXECUTION' ? 'FLAGGED' : 'READY',
              humanReviewRequired: true,
              reviewNotes: `Extracted from document ${event.documentId}, page ${item.provenance.pageNumber}.`,
              version: 1,
              executionRules: item.executionRules,
              provenance: newProvenance,
              workflowRunId: event.workflowRunId ?? event.jobId,
              correlationId: event.correlationId ?? event.jobId,
              createdAt: now,
              updatedAt: now,
            });

            existingByRequirement.set(requirementKey, {
              id: itemId,
              category: item.category,
              title: item.title,
              executionRules: item.executionRules,
              provenance: newProvenance,
            });
          }

          const allBidItems = await tx
            .select({
              category: schema.complianceItems.category,
              status: schema.complianceItems.status,
            })
            .from(schema.complianceItems)
            .where(
              and(
                eq(schema.complianceItems.bidId, event.bidId),
                eq(schema.complianceItems.organizationId, event.organizationId),
              ),
            );

          const totalRequirements = allBidItems.length;
          const flaggedRequirements = allBidItems.filter(
            (item) =>
              item.status === 'FLAGGED' || item.status === 'FAIL' || item.category === 'EXECUTION',
          ).length;
          const approvedRequirements = allBidItems.filter(
            (item) => item.status === 'READY' || item.status === 'PASS',
          ).length;

          // First update this document to COMPLETED
          await tx
            .update(schema.tenderDocuments)
            .set({
              status: 'COMPLETED',
              processingStartedAt: null,
              processingCompletedAt: now,
              lastProcessingError: null,
            })
            .where(
              and(
                eq(schema.tenderDocuments.id, event.documentId),
                eq(schema.tenderDocuments.organizationId, event.organizationId),
              ),
            );

          // Verify whether all tender documents for this bid have reached a terminal status
          const allBidDocs = await tx
            .select({
              id: schema.tenderDocuments.id,
              status: schema.tenderDocuments.status,
            })
            .from(schema.tenderDocuments)
            .where(
              and(
                eq(schema.tenderDocuments.bidId, event.bidId),
                eq(schema.tenderDocuments.organizationId, event.organizationId),
              ),
            );

          const terminalStatuses = new Set(['COMPLETED', 'FAILED']);
          const allDocsTerminal =
            allBidDocs.length > 0 && allBidDocs.every((d) => terminalStatuses.has(d.status));

          const bidUpdatePayload: {
            totalRequirements: number;
            flaggedRequirements: number;
            approvedRequirements: number;
            updatedAt: Date;
            status?: string;
          } = {
            totalRequirements,
            flaggedRequirements,
            approvedRequirements,
            updatedAt: now,
          };

          if (allDocsTerminal) {
            bidUpdatePayload.status = 'REVIEW_READY';
          }

          await tx
            .update(schema.bids)
            .set(bidUpdatePayload)
            .where(
              and(
                eq(schema.bids.id, event.bidId),
                eq(schema.bids.organizationId, event.organizationId),
              ),
            );

          await tx.insert(schema.auditLogs).values({
            id: `aud-doc-complete-${randomUUID()}`,
            bidId: event.bidId,
            organizationId: event.organizationId,
            userId: 'document-completion-worker',
            userName: 'Document Completion Worker',
            eventType: 'AI_INGESTION_COMPLETED',
            aggregateType: 'TenderDocument',
            aggregateId: event.documentId,
            payload: {
              companyId: effectiveCompanyId,
              jobId: event.jobId,
              workflowRunId: event.workflowRunId,
              correlationId: event.correlationId,
              extractedItemsCount: items.length,
            },
            timestamp: now,
          });
        });

        if (dropped) {
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
