/**
 * DocumentsRepository — Encapsulates database persistence, transactions, mutations,
 * and outbox operations for tender documents, compliance extractions, and processing runtime.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { eq, and, asc, inArray, or, lte } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import type {
  DocumentExtractionCompletedEvent,
  ExtractedComplianceItemDto,
} from '@tenderpulse/shared-types';
import {
  checkQuote,
  clauseId,
  conflictId,
  isPageTextChunk,
  locationKey,
  stripChunkHeading,
} from '@/modules/compliance/application/clause-model.js';

@Injectable()
export class DocumentsRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async findBidById(bidId: string, orgId?: string): Promise<schema.Bid | null> {
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(
        orgId
          ? and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId))
          : eq(schema.bids.id, bidId),
      )
      .limit(1);

    return bid ?? null;
  }

  async findDocumentById(docId: string, orgId?: string): Promise<schema.TenderDocument | null> {
    const [doc] = await this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        orgId
          ? and(
              eq(schema.tenderDocuments.id, docId),
              eq(schema.tenderDocuments.organizationId, orgId),
            )
          : eq(schema.tenderDocuments.id, docId),
      )
      .limit(1);

    return doc ?? null;
  }

  async listDocumentsByBid(bidId: string, orgId: string): Promise<schema.TenderDocument[]> {
    return this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.tenderDocuments.uploadedAt));
  }

  async createDocumentWithOutbox(
    docData: typeof schema.tenderDocuments.$inferInsert,
    outboxData: typeof schema.documentProcessingOutbox.$inferInsert,
  ): Promise<schema.TenderDocument> {
    return this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(schema.tenderDocuments)
        .values(docData)
        .returning();

      if (!doc) {
        throw new Error('Failed to create tender document.');
      }

      await tx.insert(schema.documentProcessingOutbox).values(outboxData);
      return doc;
    });
  }

  async upsertDocumentWithOutbox(params: {
    docData: typeof schema.tenderDocuments.$inferInsert;
    outboxData: typeof schema.documentProcessingOutbox.$inferInsert;
    bidId: string;
    orgId: string;
    now: Date;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const persistedDocument = await tx
        .insert(schema.tenderDocuments)
        .values(params.docData)
        .onConflictDoUpdate({
          target: schema.tenderDocuments.id,
          set: {
            fileName: params.docData.fileName,
            storagePath: params.docData.storagePath,
            fileSizeBytes: params.docData.fileSizeBytes,
            mimeType: params.docData.mimeType,
            documentType: params.docData.documentType,
            status: params.docData.status,
            processingAttempts: 0,
            processingStartedAt: null,
            processingCompletedAt: null,
            lastProcessingError: null,
            uploadedAt: params.now,
          },
        })
        .returning();

      if (!persistedDocument || persistedDocument.length === 0) {
        throw new Error(`Failed to persist tender document record '${params.docData.id}'.`);
      }

      await tx
        .insert(schema.documentProcessingOutbox)
        .values(params.outboxData)
        .onConflictDoUpdate({
          target: schema.documentProcessingOutbox.id,
          set: {
            organizationId: params.orgId,
            documentId: params.docData.id,
            payload: params.outboxData.payload,
            status: 'PENDING',
            nextAttemptAt: params.now,
            attempts: 0,
            lastError: null,
            lockedAt: null,
          },
        });

      await tx
        .update(schema.bids)
        .set({
          status: 'QUEUED',
          updatedAt: params.now,
        })
        .where(and(eq(schema.bids.id, params.bidId), eq(schema.bids.organizationId, params.orgId)));
    });
  }

  async confirmDocumentUploadWithOutbox(params: {
    docId: string;
    bidId: string;
    orgId: string;
    userId: string;
    fileName: string;
    storagePath: string;
    fileSizeBytes: number;
    mimeType: string;
    documentType: string;
    message: unknown;
    now: Date;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const persistedDocument = await tx
        .insert(schema.tenderDocuments)
        .values({
          id: params.docId,
          bidId: params.bidId,
          organizationId: params.orgId,
          fileName: params.fileName,
          storagePath: params.storagePath,
          fileSizeBytes: params.fileSizeBytes,
          mimeType: params.mimeType,
          documentType: params.documentType,
          status: 'QUEUED_FOR_EXTRACTION',
          processingAttempts: 0,
          processingStartedAt: null,
          processingCompletedAt: null,
          lastProcessingError: null,
          uploadedAt: params.now,
        })
        .onConflictDoUpdate({
          target: schema.tenderDocuments.id,
          set: {
            fileName: params.fileName,
            storagePath: params.storagePath,
            fileSizeBytes: params.fileSizeBytes,
            mimeType: params.mimeType,
            documentType: params.documentType,
            status: 'QUEUED_FOR_EXTRACTION',
            processingAttempts: 0,
            processingStartedAt: null,
            processingCompletedAt: null,
            lastProcessingError: null,
            uploadedAt: params.now,
          },
          setWhere: and(
            eq(schema.tenderDocuments.organizationId, params.orgId),
            eq(schema.tenderDocuments.bidId, params.bidId),
          ),
        })
        .returning({ id: schema.tenderDocuments.id });

      if (persistedDocument.length === 0) {
        throw new Error('CONFLICT: Document ID is already assigned to another tenant or bid.');
      }

      await tx
        .update(schema.bids)
        .set({ status: 'QUEUED', updatedAt: params.now })
        .where(and(eq(schema.bids.id, params.bidId), eq(schema.bids.organizationId, params.orgId)));

      await tx.insert(schema.auditLogs).values({
        id: `aud-upload-${params.docId}-${randomUUID()}`,
        bidId: params.bidId,
        organizationId: params.orgId,
        userId: params.userId,
        userName: params.userId,
        eventType: 'DOCUMENT_UPLOADED',
        aggregateType: 'TenderDocument',
        aggregateId: params.docId,
        payload: { fileName: params.fileName, storagePath: params.storagePath },
        timestamp: params.now,
      });

      await tx
        .insert(schema.documentProcessingOutbox)
        .values({
          id: `outbox-${params.docId}`,
          organizationId: params.orgId,
          documentId: params.docId,
          payload: params.message as Record<string, unknown>,
          status: 'PENDING',
          nextAttemptAt: params.now,
          createdAt: params.now,
        })
        .onConflictDoUpdate({
          target: schema.documentProcessingOutbox.id,
          set: {
            payload: params.message as Record<string, unknown>,
            status: 'PENDING',
            attempts: 0,
            nextAttemptAt: params.now,
            lastError: null,
            publishedAt: null,
          },
        });
    });
  }

  async queueReprocessing(params: {
    docId: string;
    bidId: string;
    orgId: string;
    now: Date;
    outboxData: typeof schema.documentProcessingOutbox.$inferInsert;
    auditLogData: typeof schema.auditLogs.$inferInsert;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.tenderDocuments)
        .set({
          status: 'QUEUED_FOR_EXTRACTION',
          processingAttempts: 0,
          processingStartedAt: null,
          processingCompletedAt: null,
          lastProcessingError: null,
        })
        .where(
          and(
            eq(schema.tenderDocuments.id, params.docId),
            eq(schema.tenderDocuments.bidId, params.bidId),
            eq(schema.tenderDocuments.organizationId, params.orgId),
          ),
        );

      await tx
        .update(schema.bids)
        .set({ status: 'QUEUED', updatedAt: params.now })
        .where(and(eq(schema.bids.id, params.bidId), eq(schema.bids.organizationId, params.orgId)));

      await tx.insert(schema.documentProcessingOutbox).values(params.outboxData);
      await tx.insert(schema.auditLogs).values(params.auditLogData);
    });
  }

  async insertOutboxEvent(
    outboxData: typeof schema.documentProcessingOutbox.$inferInsert,
  ): Promise<void> {
    await this.db.insert(schema.documentProcessingOutbox).values(outboxData);
  }

  async updateDocumentStatus(
    docId: string,
    orgId: string,
    data: Partial<typeof schema.tenderDocuments.$inferInsert>,
  ): Promise<schema.TenderDocument | null> {
    const [updated] = await this.db
      .update(schema.tenderDocuments)
      .set(data)
      .where(
        and(
          eq(schema.tenderDocuments.id, docId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .returning();

    return updated ?? null;
  }

  async updateBidStatus(
    bidId: string,
    orgId: string,
    status: string,
  ): Promise<void> {
    await this.db
      .update(schema.bids)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));
  }

  async listComplianceItemsByBid(
    bidId: string,
    orgId: string,
  ): Promise<schema.ComplianceItem[]> {
    return this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );
  }

  async deleteDocumentCascade(params: {
    docId: string;
    bidId: string;
    orgId: string;
    auditLog: typeof schema.auditLogs.$inferInsert;
    complianceItemIdsToDelete?: string[];
    updatedMetrics: {
      totalRequirements: number;
      flaggedRequirements: number;
      approvedRequirements: number;
      status?: string;
      updatedAt: Date;
    };
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Audit log
      await tx.insert(schema.auditLogs).values(params.auditLog);

      // 2. Delete document
      await tx
        .delete(schema.tenderDocuments)
        .where(
          and(
            eq(schema.tenderDocuments.id, params.docId),
            eq(schema.tenderDocuments.bidId, params.bidId),
            eq(schema.tenderDocuments.organizationId, params.orgId),
          ),
        );

      // 3. Delete compliance items
      if (params.complianceItemIdsToDelete && params.complianceItemIdsToDelete.length > 0) {
        await tx
          .delete(schema.complianceItems)
          .where(inArray(schema.complianceItems.id, params.complianceItemIdsToDelete));
      }

      // 3b. Conflicts and coverage recorded for this document
      await tx
        .delete(schema.clauseConflicts)
        .where(
          and(
            eq(schema.clauseConflicts.documentId, params.docId),
            eq(schema.clauseConflicts.organizationId, params.orgId),
          ),
        );
      await tx
        .delete(schema.extractionCoverage)
        .where(
          and(
            eq(schema.extractionCoverage.documentId, params.docId),
            eq(schema.extractionCoverage.organizationId, params.orgId),
          ),
        );

      // 4. Update parent bid metrics
      await tx
        .update(schema.bids)
        .set(params.updatedMetrics)
        .where(
          and(
            eq(schema.bids.id, params.bidId),
            eq(schema.bids.organizationId, params.orgId),
          ),
        );
    });
  }

  async createAuditLog(entry: typeof schema.auditLogs.$inferInsert): Promise<void> {
    await this.db.insert(schema.auditLogs).values(entry);
  }

  // --- DocumentCompletionService & Outbox operations ---

  async markDocumentFailed(params: {
    documentId: string;
    organizationId: string;
    bidId: string;
    error?: string;
    now: Date;
  }): Promise<{ updated: boolean }> {
    const updated = await this.db
      .update(schema.tenderDocuments)
      .set({
        status: 'FAILED',
        processingStartedAt: null,
        processingCompletedAt: params.now,
        lastProcessingError: params.error || 'Document extraction failed in AI worker.',
      })
      .where(
        and(
          eq(schema.tenderDocuments.id, params.documentId),
          eq(schema.tenderDocuments.organizationId, params.organizationId),
        ),
      )
      .returning({ id: schema.tenderDocuments.id });

    if (updated.length === 0) {
      return { updated: false };
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
          eq(schema.tenderDocuments.bidId, params.bidId),
          eq(schema.tenderDocuments.organizationId, params.organizationId),
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
          updatedAt: params.now,
        })
        .where(
          and(
            eq(schema.bids.id, params.bidId),
            eq(schema.bids.organizationId, params.organizationId),
          ),
        );
    }

    return { updated: true };
  }

  async completeExtraction(params: {
    event: DocumentExtractionCompletedEvent;
    items: ExtractedComplianceItemDto[];
    now: Date;
  }): Promise<{ dropped: boolean; effectiveCompanyId?: string }> {
    const { event, items, now } = params;
    let dropped = false;
    let effectiveCompanyId: string | undefined;

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
        dropped = true;
        return;
      }

      effectiveCompanyId = event.companyId || lockedBid.companyId;

      // ── Page text for server-side quote verification (and the source viewer) ──
      if (event.chunks && event.chunks.length > 0) {
        await tx
          .delete(schema.tenderDocumentChunks)
          .where(
            and(
              eq(schema.tenderDocumentChunks.documentId, event.documentId),
              eq(schema.tenderDocumentChunks.organizationId, event.organizationId),
            ),
          );

        const chunkRows = event.chunks.map((chunk, idx) => ({
          id: chunk.id || chunk.chunkId || `chk-${randomUUID()}`,
          organizationId: event.organizationId,
          bidId: event.bidId,
          documentId: event.documentId,
          chunkIndex: chunk.chunkIndex ?? idx,
          chunkType: chunk.chunkType || 'PROSE',
          content: chunk.content,
          pageNumber: chunk.pageNumber ?? 1,
          sectionTitle: chunk.sectionTitle ?? null,
          clauseReference: chunk.clauseReference ?? null,
          boundingBox: chunk.boundingBox ?? null,
          metadata: chunk.metadata ?? null,
          embedding: chunk.embedding ?? null,
          createdAt: now,
        }));

        const CHUNK_BATCH_SIZE = 100;
        for (let i = 0; i < chunkRows.length; i += CHUNK_BATCH_SIZE) {
          const batch = chunkRows.slice(i, i + CHUNK_BATCH_SIZE);
          await tx.insert(schema.tenderDocumentChunks).values(batch);
        }
      }
      const storedChunks = await tx
        .select({
          pageNumber: schema.tenderDocumentChunks.pageNumber,
          content: schema.tenderDocumentChunks.content,
          chunkType: schema.tenderDocumentChunks.chunkType,
        })
        .from(schema.tenderDocumentChunks)
        .where(
          and(
            eq(schema.tenderDocumentChunks.documentId, event.documentId),
            eq(schema.tenderDocumentChunks.organizationId, event.organizationId),
          ),
        );
      const textByPage = new Map<number, string[]>();
      for (const c of storedChunks.filter((c) => isPageTextChunk(c.chunkType))) {
        textByPage.set(c.pageNumber, [
          ...(textByPage.get(c.pageNumber) ?? []),
          stripChunkHeading(c.content),
        ]);
      }

      // ── Clauses: one row per location (document, page, quote); never merged by title ──
      const existingDocRows = await tx
        .select({
          id: schema.complianceItems.id,
          reviewStatus: schema.complianceItems.reviewStatus,
        })
        .from(schema.complianceItems)
        .where(
          and(
            eq(schema.complianceItems.bidId, event.bidId),
            eq(schema.complianceItems.organizationId, event.organizationId),
            eq(schema.complianceItems.documentId, event.documentId),
          ),
        );
      const existingById = new Map(existingDocRows.map((r) => [r.id, r]));
      const idByItemKey = new Map<string, string>();
      const seen = new Set<string>();

      for (const [index, item] of items.entries()) {
        if (item.is_conflict) {
          // Pre-Phase-1 AI payload: conflicts were sent as pseudo clauses. They are not
          // clauses; current payloads send them in event.conflicts.
          continue;
        }
        const page = item.provenance.pageNumber;
        const quote = item.provenance.verbatimQuote;
        const itemKey = item.itemKey || locationKey(event.documentId, page, quote);
        const id = clauseId(event.organizationId, event.bidId, itemKey);
        idByItemKey.set(itemKey, id);
        if (seen.has(id)) continue; // same location twice in one payload
        seen.add(id);

        const supporting = (item.provenance.supportingPages ?? []).filter((p) => p !== page);
        const pagesToCheck = [page, ...supporting, page + 1];
        const quoteCheck = checkQuote(
          quote,
          pagesToCheck.flatMap((p) => textByPage.get(p) ?? []),
        );
        const flags = [...(item.flags ?? [])];
        const provenance = {
          documentId: event.documentId,
          sourceDocumentId: event.documentId,
          documentName: lockedDocument.fileName,
          sourceFileName: lockedDocument.fileName,
          pageNumber: page,
          sectionOrClause: item.provenance.clauseReference ?? null,
          clauseReference: item.provenance.clauseReference ?? null,
          verbatimQuote: quote,
          confidenceScore: item.provenance.confidenceScore ?? null,
        };
        const aiFields = {
          companyId: effectiveCompanyId,
          category: item.category,
          title: item.title,
          description: item.description ?? '',
          executionRules: item.executionRules ?? {},
          provenance,
          documentId: event.documentId,
          itemKey,
          docOrder: item.docOrder ?? index,
          primaryPage: page,
          supportingPages: supporting,
          clauseRef: item.provenance.clauseReference ?? null,
          sourceBlockId: item.provenance.sourceBlockId ?? null,
          quoteCheck,
          attributes: item.attributes ?? null,
          flags,
          workflowRunId: event.workflowRunId ?? event.jobId,
          correlationId: event.correlationId ?? event.jobId,
          updatedAt: now,
        };

        if (existingById.has(id)) {
          // Re-extraction of the same text: refresh the AI fields, keep the human review.
          await tx
            .update(schema.complianceItems)
            .set(aiFields)
            .where(eq(schema.complianceItems.id, id));
          continue;
        }

        await tx.insert(schema.complianceItems).values({
          id,
          bidId: event.bidId,
          organizationId: event.organizationId,
          ...aiFields,
          // Nothing has been reviewed yet. Status is never derived from the category.
          status: 'PENDING',
          reviewStatus: 'UNREVIEWED',
          fulfilmentStatus: 'NOT_STARTED',
          humanReviewRequired: true,
          reviewNotes: null,
          version: 1,
          createdAt: now,
        });
      }

      // Clauses of this document that the new extraction no longer contains: unreviewed ones
      // go; anything a person reviewed is kept.
      const stale = existingDocRows
        .filter((r) => !seen.has(r.id) && r.reviewStatus === 'UNREVIEWED')
        .map((r) => r.id);
      if (stale.length > 0) {
        await tx.delete(schema.complianceItems).where(inArray(schema.complianceItems.id, stale));
      }

      // ── Conflicts: own records, each value linked to the clause that states it ──
      const existingConflicts = await tx
        .select({
          id: schema.clauseConflicts.id,
          resolution: schema.clauseConflicts.resolution,
        })
        .from(schema.clauseConflicts)
        .where(
          and(
            eq(schema.clauseConflicts.bidId, event.bidId),
            eq(schema.clauseConflicts.organizationId, event.organizationId),
            eq(schema.clauseConflicts.documentId, event.documentId),
          ),
        );
      const conflictIdsSeen = new Set<string>();
      for (const c of event.conflicts ?? []) {
        const values = c.values
          .filter((v) => idByItemKey.has(v.itemKey))
          .map((v) => ({
            display: v.display,
            clauseId: idByItemKey.get(v.itemKey) as string,
            quote: v.quote,
            page: v.page,
            clauseRef: v.clauseRef ?? null,
          }));
        if (values.length < 2) continue;
        const id = conflictId(event.organizationId, event.bidId, c.conflictKey);
        conflictIdsSeen.add(id);
        await tx
          .insert(schema.clauseConflicts)
          .values({
            id,
            organizationId: event.organizationId,
            bidId: event.bidId,
            documentId: event.documentId,
            topic: c.topic,
            attribute: c.attribute,
            values,
            aiPrecedenceNote: c.aiPrecedenceNote ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.clauseConflicts.id,
            set: {
              topic: c.topic,
              attribute: c.attribute,
              values,
              aiPrecedenceNote: c.aiPrecedenceNote ?? null,
              updatedAt: now,
            },
          });
      }
      const staleConflicts = existingConflicts
        .filter((c) => !conflictIdsSeen.has(c.id) && c.resolution === 'UNRESOLVED')
        .map((c) => c.id);
      if (staleConflicts.length > 0) {
        await tx
          .delete(schema.clauseConflicts)
          .where(inArray(schema.clauseConflicts.id, staleConflicts));
      }

      // ── Coverage: which pages were analysed ──
      if (event.coverage) {
        const coverageRow = {
          organizationId: event.organizationId,
          bidId: event.bidId,
          pageCount: event.coverage.pageCount,
          failedPages: event.coverage.failedPages ?? [],
          status: event.coverage.status,
          updatedAt: now,
        };
        await tx
          .insert(schema.extractionCoverage)
          .values({ documentId: event.documentId, ...coverageRow })
          .onConflictDoUpdate({
            target: schema.extractionCoverage.documentId,
            set: coverageRow,
          });
      }

      const allBidItems = await tx
        .select({
          status: schema.complianceItems.status,
          reviewStatus: schema.complianceItems.reviewStatus,
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
        (item) => item.reviewStatus === 'NEEDS_REVIEW' || item.status === 'FAIL',
      ).length;
      const approvedRequirements = allBidItems.filter(
        (item) => item.reviewStatus === 'CONFIRMED' || item.reviewStatus === 'CORRECTED',
      ).length;

      // Update this document to COMPLETED
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

    return { dropped, effectiveCompanyId };
  }

  // --- Outbox operations ---

  async claimOutboxMessage(id: string, now: Date, staleLease: Date): Promise<boolean> {
    const claim = await this.db
      .update(schema.documentProcessingOutbox)
      .set({ status: 'PUBLISHING', lockedAt: now })
      .where(
        and(
          eq(schema.documentProcessingOutbox.id, id),
          or(
            and(
              eq(schema.documentProcessingOutbox.status, 'PENDING'),
              lte(schema.documentProcessingOutbox.nextAttemptAt, now),
            ),
            and(
              eq(schema.documentProcessingOutbox.status, 'PUBLISHING'),
              lte(schema.documentProcessingOutbox.lockedAt, staleLease),
            ),
          ),
        ),
      )
      .returning({ id: schema.documentProcessingOutbox.id });

    return claim.length > 0;
  }

  async markOutboxPublished(id: string, publishedAt: Date): Promise<void> {
    await this.db
      .update(schema.documentProcessingOutbox)
      .set({
        status: 'PUBLISHED',
        publishedAt,
        lockedAt: null,
        lastError: null,
      })
      .where(eq(schema.documentProcessingOutbox.id, id));
  }

  async markOutboxFailed(
    id: string,
    attempts: number,
    lastError: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.db
      .update(schema.documentProcessingOutbox)
      .set({
        attempts,
        lastError,
        nextAttemptAt,
        status: 'PENDING',
        lockedAt: null,
      })
      .where(eq(schema.documentProcessingOutbox.id, id));
  }
}
