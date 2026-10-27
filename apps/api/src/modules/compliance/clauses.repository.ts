/**
 * ClausesRepository — persistence for the Phase 1 clause endpoints (clauses, conflicts,
 * coverage, page text, clause history).
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

export type ClauseUpdate = Partial<
  Pick<
    schema.ComplianceItem,
    | 'title'
    | 'description'
    | 'clauseRef'
    | 'attributes'
    | 'provenance'
    | 'status'
    | 'reviewStatus'
    | 'reviewedBy'
    | 'reviewedByName'
    | 'reviewedAt'
    | 'reviewNotes'
    | 'humanReviewRequired'
  >
>;

@Injectable()
export class ClausesRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  async findBid(bidId: string, orgId: string): Promise<schema.Bid | null> {
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);
    return bid ?? null;
  }

  async listDocuments(bidId: string, orgId: string): Promise<schema.TenderDocument[]> {
    return this.db
      .select()
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.tenderDocuments.uploadedAt), asc(schema.tenderDocuments.id));
  }

  async listClauses(bidId: string, orgId: string): Promise<schema.ComplianceItem[]> {
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

  async findClause(
    bidId: string,
    clauseId: string,
    orgId: string,
  ): Promise<schema.ComplianceItem | null> {
    const [row] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.id, clauseId),
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listConflicts(bidId: string, orgId: string): Promise<schema.ClauseConflictRow[]> {
    return this.db
      .select()
      .from(schema.clauseConflicts)
      .where(
        and(
          eq(schema.clauseConflicts.bidId, bidId),
          eq(schema.clauseConflicts.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.clauseConflicts.createdAt), asc(schema.clauseConflicts.id));
  }

  async listCoverage(bidId: string, orgId: string): Promise<schema.ExtractionCoverageRow[]> {
    return this.db
      .select()
      .from(schema.extractionCoverage)
      .where(
        and(
          eq(schema.extractionCoverage.bidId, bidId),
          eq(schema.extractionCoverage.organizationId, orgId),
        ),
      );
  }

  async listPageChunks(
    bidId: string,
    documentId: string,
    pages: number[],
    orgId: string,
  ): Promise<schema.TenderDocumentChunk[]> {
    if (pages.length === 0) return [];
    return this.db
      .select()
      .from(schema.tenderDocumentChunks)
      .where(
        and(
          eq(schema.tenderDocumentChunks.bidId, bidId),
          eq(schema.tenderDocumentChunks.documentId, documentId),
          eq(schema.tenderDocumentChunks.organizationId, orgId),
          inArray(schema.tenderDocumentChunks.pageNumber, pages),
        ),
      )
      .orderBy(
        asc(schema.tenderDocumentChunks.pageNumber),
        asc(schema.tenderDocumentChunks.chunkIndex),
      );
  }

  async listClauseHistory(
    bidId: string,
    clauseId: string,
    orgId: string,
  ): Promise<schema.AuditLog[]> {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.bidId, bidId),
          eq(schema.auditLogs.organizationId, orgId),
          eq(schema.auditLogs.aggregateId, clauseId),
        ),
      )
      .orderBy(asc(schema.auditLogs.timestamp));
  }

  /** Optimistic update: applies only when the stored version still matches. */
  async updateClause(
    clauseId: string,
    orgId: string,
    expectedVersion: number,
    data: ClauseUpdate,
    audit: schema.NewAuditLog,
    now: Date,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(schema.complianceItems)
        .set({ ...data, version: expectedVersion + 1, updatedAt: now })
        .where(
          and(
            eq(schema.complianceItems.id, clauseId),
            eq(schema.complianceItems.organizationId, orgId),
            eq(schema.complianceItems.version, expectedVersion),
          ),
        )
        .returning({ id: schema.complianceItems.id });
      if (updated.length === 0) return false;
      await tx.insert(schema.auditLogs).values(audit);
      return true;
    });
  }

  /** All-or-nothing confirmation of several clauses with one audit event. */
  async confirmClauses(
    rows: { id: string; version: number; status: string }[],
    orgId: string,
    data: ClauseUpdate,
    audit: schema.NewAuditLog,
    now: Date,
  ): Promise<boolean> {
    return this.db
      .transaction(async (tx) => {
        for (const row of rows) {
          const updated = await tx
            .update(schema.complianceItems)
            .set({
              ...data,
              status: row.status,
              version: row.version + 1,
              updatedAt: now,
            })
            .where(
              and(
                eq(schema.complianceItems.id, row.id),
                eq(schema.complianceItems.organizationId, orgId),
                eq(schema.complianceItems.version, row.version),
              ),
            )
            .returning({ id: schema.complianceItems.id });
          if (updated.length === 0) {
            tx.rollback();
          }
        }
        await tx.insert(schema.auditLogs).values(audit);
        return true;
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'TransactionRollbackError') return false;
        throw err;
      });
  }

  async updateConflict(
    conflictId: string,
    orgId: string,
    expectedVersion: number,
    data: Partial<
      Pick<
        schema.ClauseConflictRow,
        'resolution' | 'chosenClauseId' | 'note' | 'resolvedBy' | 'resolvedByName' | 'resolvedAt'
      >
    >,
    audit: schema.NewAuditLog,
    now: Date,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(schema.clauseConflicts)
        .set({ ...data, version: expectedVersion + 1, updatedAt: now })
        .where(
          and(
            eq(schema.clauseConflicts.id, conflictId),
            eq(schema.clauseConflicts.organizationId, orgId),
            eq(schema.clauseConflicts.version, expectedVersion),
          ),
        )
        .returning({ id: schema.clauseConflicts.id });
      if (updated.length === 0) return false;
      await tx.insert(schema.auditLogs).values(audit);
      return true;
    });
  }

  async updateBidCounters(
    bidId: string,
    orgId: string,
    data: {
      totalRequirements: number;
      flaggedRequirements: number;
      approvedRequirements: number;
    },
    now: Date,
  ): Promise<void> {
    await this.db
      .update(schema.bids)
      .set({ ...data, updatedAt: now })
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));
  }
}
