/**
 * ClausesService — Phase 1 clause endpoints: list, detail, review (with the source-opened
 * forcing function and optimistic versioning), bulk confirm, conflicts, coverage, summary
 * and the page text layer. Every value comes from the tender or is reported as not stated.
 */
import { Injectable, Inject } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  BidClauseSummary,
  BulkReviewRequest,
  Clause,
  ClauseDetail,
  ClauseHistoryEvent,
  ClauseListResponse,
  ClauseReviewRequest,
  Conflict,
  ConflictResolution,
  ConflictResolutionRequest,
  Coverage,
  CoverageStatus,
  DocumentPageText,
  ReviewStatus,
} from '@tenderpulse/shared-types';
import type * as schema from '@/common/database/schema.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnprocessableError,
} from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import {
  EMPTY_ATTRIBUTES,
  buildFacets,
  isPageTextChunk,
  stripChunkHeading,
  compareDocOrder,
  legacyStatusFor,
  requiresSourceForConfirm,
  toClause,
} from './application/clause-model.js';
import { ClausesRepository, type ClauseUpdate } from './clauses.repository.js';

const RESOLUTIONS: ConflictResolution[] = [
  'UNRESOLVED',
  'ACCEPTED_VALUE',
  'QUERY_RAISED',
  'RESOLVED_BY_CORRIGENDUM',
];
const MAX_BULK = 500;

interface Actor {
  orgId: string;
  userId: string;
  userName: string;
}

@Injectable()
export class ClausesService {
  constructor(@Inject(ClausesRepository) private readonly repo: ClausesRepository) {}

  private actor(): Actor {
    const ctx = TenantContextHolder.getRequired();
    return {
      orgId: ctx.organizationId,
      userId: ctx.userId,
      userName: ctx.userName || ctx.userId,
    };
  }

  private async requireBid(bidId: string, orgId: string): Promise<schema.Bid> {
    const bid = await this.repo.findBid(bidId, orgId);
    if (!bid) throw new NotFoundError(`Bid '${bidId}' not found.`);
    return bid;
  }

  /** All clauses of a bid in document reading order, with conflict links. */
  private async loadClauses(
    bidId: string,
    orgId: string,
  ): Promise<{
    clauses: Clause[];
    conflicts: Conflict[];
    docs: schema.TenderDocument[];
  }> {
    const [rows, conflictRows, docs] = await Promise.all([
      this.repo.listClauses(bidId, orgId),
      this.repo.listConflicts(bidId, orgId),
      this.repo.listDocuments(bidId, orgId),
    ]);
    const conflicts = conflictRows.map((c) => this.toConflict(c));
    const byClause = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const v of c.values) byClause.set(v.clauseId, [...(byClause.get(v.clauseId) ?? []), c]);
    }
    const docRank = new Map(docs.map((d, i) => [d.id, i]));
    const clauses = rows
      .map((row) => {
        const linked = byClause.get(row.id) ?? [];
        return toClause(
          row,
          linked.map((c) => c.id),
          linked.some((c) => c.resolution === 'UNRESOLVED'),
        );
      })
      .sort(compareDocOrder(docRank));
    return { clauses, conflicts, docs };
  }

  private toConflict(row: schema.ClauseConflictRow): Conflict {
    return {
      id: row.id,
      topic: row.topic,
      attribute: row.attribute,
      values: row.values ?? [],
      aiPrecedenceNote: row.aiPrecedenceNote ?? null,
      resolution: row.resolution as ConflictResolution,
      chosenClauseId: row.chosenClauseId ?? null,
      note: row.note ?? null,
      resolvedBy:
        row.resolvedBy && row.resolution !== 'UNRESOLVED'
          ? { id: row.resolvedBy, name: row.resolvedByName || row.resolvedBy }
          : null,
      resolvedAt:
        row.resolvedAt && row.resolution !== 'UNRESOLVED'
          ? new Date(row.resolvedAt).toISOString()
          : null,
      version: row.version,
    };
  }

  // ─────────────────────────────── Reads ───────────────────────────────

  async list(bidId: string): Promise<{ body: ClauseListResponse; etag: string }> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    const { clauses } = await this.loadClauses(bidId, orgId);
    const body: ClauseListResponse = {
      clauses,
      total: clauses.length,
      facets: buildFacets(clauses),
    };
    const etag = `"${createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32)}"`;
    return { body, etag };
  }

  async detail(bidId: string, clauseId: string): Promise<ClauseDetail> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    const { clauses, conflicts } = await this.loadClauses(bidId, orgId);
    const index = clauses.findIndex((c) => c.id === clauseId);
    if (index < 0) throw new NotFoundError(`Clause '${clauseId}' not found.`);
    const clause = clauses[index] as Clause;

    let context: ClauseDetail['context'] = null;
    if (clause.documentId && clause.pages.primary > 0) {
      const chunks = await this.repo.listPageChunks(
        bidId,
        clause.documentId,
        [clause.pages.primary],
        orgId,
      );
      context = surroundingText(
        chunks.filter((c) => isPageTextChunk(c.chunkType)).map((c) => stripChunkHeading(c.content)),
        clause.quote,
      );
    }

    const row = await this.repo.findClause(bidId, clauseId, orgId);
    const audit = await this.repo.listClauseHistory(bidId, clauseId, orgId);
    const history: ClauseHistoryEvent[] = [
      {
        at: row ? new Date(row.createdAt).toISOString() : new Date(0).toISOString(),
        by: null,
        kind: 'AI_EXTRACTED',
        detail: {},
      },
      ...audit.map((a) => ({
        at: new Date(a.timestamp).toISOString(),
        by: { id: a.userId, name: a.userName },
        kind: a.eventType,
        detail: (a.payload ?? {}) as Record<string, unknown>,
      })),
    ];

    return {
      ...clause,
      context,
      conflicts: conflicts.filter((c) => clause.conflictIds.includes(c.id)),
      history,
      prevId: clauses[index - 1]?.id ?? null,
      nextId: clauses[index + 1]?.id ?? null,
    };
  }

  async conflicts(bidId: string): Promise<Conflict[]> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    return (await this.repo.listConflicts(bidId, orgId)).map((c) => this.toConflict(c));
  }

  async coverage(bidId: string): Promise<Coverage> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    const [docs, rows] = await Promise.all([
      this.repo.listDocuments(bidId, orgId),
      this.repo.listCoverage(bidId, orgId),
    ]);
    return buildCoverage(docs, rows);
  }

  async summary(bidId: string): Promise<BidClauseSummary> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    const [{ clauses, conflicts, docs }, rows] = await Promise.all([
      this.loadClauses(bidId, orgId),
      this.repo.listCoverage(bidId, orgId),
    ]);
    const coverage = buildCoverage(docs, rows);
    const review = buildFacets(clauses).reviewStatus;
    const open = (c: Clause) =>
      c.review.status === 'UNREVIEWED' || c.review.status === 'NEEDS_REVIEW';
    const unresolved = conflicts.filter((c) => c.resolution === 'UNRESOLVED').length;
    const pagesNotAnalysed = coverage.documents.reduce((n, d) => n + d.failedPages.length, 0);
    return {
      documents: docs.length,
      clauses: clauses.length,
      review,
      conflicts: { total: conflicts.length, unresolved },
      coverage: coverage.status,
      pagesNotAnalysed,
      attention: {
        conflicts: unresolved,
        pagesNotAnalysed,
        disqualifyingUnreviewed: clauses.filter((c) => c.disqualifying === true && open(c)).length,
        quoteNotFound: clauses.filter((c) => c.quoteCheck === 'NOT_FOUND').length,
        needsOutsideParty: clauses.filter((c) => c.parties.some((p) => p !== 'BIDDER')).length,
      },
      deadlines: clauses
        .filter((c) => c.deadline && c.review.status !== 'NOT_A_REQUIREMENT')
        .map((c) => ({
          clauseId: c.id,
          title: c.title,
          deadline: c.deadline as NonNullable<Clause['deadline']>,
          clauseRef: c.clauseRef,
          page: c.pages.primary,
        })),
      amounts: clauses
        .filter((c) => c.amount && c.review.status !== 'NOT_A_REQUIREMENT')
        .map((c) => ({
          clauseId: c.id,
          title: c.title,
          amount: c.amount as NonNullable<Clause['amount']>,
          clauseRef: c.clauseRef,
          page: c.pages.primary,
        })),
    };
  }

  async pageText(bidId: string, documentId: string, page: number): Promise<DocumentPageText> {
    const { orgId } = this.actor();
    await this.requireBid(bidId, orgId);
    if (!Number.isInteger(page) || page < 1)
      throw new BadRequestError('Page must be a positive integer.');
    const docs = await this.repo.listDocuments(bidId, orgId);
    if (!docs.some((d) => d.id === documentId)) {
      throw new NotFoundError(`Document '${documentId}' not found.`);
    }
    const chunks = await this.repo.listPageChunks(bidId, documentId, [page], orgId);
    return {
      documentId,
      page,
      blocks: chunks
        .filter((c) => isPageTextChunk(c.chunkType))
        .map((c) => ({
          id: c.id,
          text: stripChunkHeading(c.content),
          clauseRef: c.clauseReference ?? null,
          boundingBox: c.boundingBox ?? null,
        })),
    };
  }

  // ─────────────────────────────── Writes ───────────────────────────────

  async review(bidId: string, clauseId: string, req: ClauseReviewRequest): Promise<ClauseDetail> {
    const actor = this.actor();
    await this.requireBid(bidId, actor.orgId);
    const { clauses, conflicts } = await this.loadClauses(bidId, actor.orgId);
    const clause = clauses.find((c) => c.id === clauseId);
    const row = await this.repo.findClause(bidId, clauseId, actor.orgId);
    if (!clause || !row) throw new NotFoundError(`Clause '${clauseId}' not found.`);
    if (!Number.isInteger(req?.expectedVersion)) {
      throw new BadRequestError('expectedVersion is required.');
    }
    if (req.expectedVersion !== row.version) {
      throw new ConflictError(
        `This clause was changed by someone else (version ${row.version}). Reload to see the changes.`,
      );
    }

    const now = new Date();
    const note = typeof req.note === 'string' && req.note.trim() ? req.note.trim() : null;
    let nextStatus: ReviewStatus;
    const update: ClauseUpdate = {};
    const auditPayload: Record<string, unknown> = {
      action: req.action,
      from: clause.review.status,
      sourceOpened: Boolean(req.sourceOpened),
      note,
    };

    switch (req.action) {
      case 'CONFIRM': {
        const open = conflicts.filter(
          (c) => clause.conflictIds.includes(c.id) && c.resolution === 'UNRESOLVED',
        );
        if (open.length > 0) {
          throw new UnprocessableError(
            'This clause is part of an unresolved conflict. Resolve the conflict before confirming.',
          );
        }
        if (requiresSourceForConfirm(clause) && !req.sourceOpened) {
          throw new UnprocessableError('Open the source to confirm this clause.');
        }
        if (clause.quoteCheck === 'NOT_FOUND' && !note) {
          throw new UnprocessableError(
            'The quote was not found in the page text. Correct the clause or add a note explaining the confirmation.',
          );
        }
        nextStatus = 'CONFIRMED';
        break;
      }
      case 'CORRECT': {
        const corrections = req.corrections ?? {};
        const diff = applyCorrections(row, corrections, update);
        if (Object.keys(diff).length === 0) {
          throw new BadRequestError('CORRECT needs at least one changed field.');
        }
        auditPayload.diff = diff;
        nextStatus = 'CORRECTED';
        break;
      }
      case 'NOT_A_REQUIREMENT':
        nextStatus = 'NOT_A_REQUIREMENT';
        break;
      case 'NEEDS_REVIEW':
        nextStatus = 'NEEDS_REVIEW';
        break;
      case 'UNREVIEW':
        nextStatus = 'UNREVIEWED';
        break;
      default:
        throw new BadRequestError(`Unknown review action '${String(req?.action)}'.`);
    }

    auditPayload.to = nextStatus;
    Object.assign(update, {
      reviewStatus: nextStatus,
      status: legacyStatusFor(nextStatus, row.status),
      reviewedBy: nextStatus === 'UNREVIEWED' ? null : actor.userId,
      reviewedByName: nextStatus === 'UNREVIEWED' ? null : actor.userName,
      reviewedAt: nextStatus === 'UNREVIEWED' ? null : now,
      reviewNotes: note,
      humanReviewRequired: nextStatus === 'UNREVIEWED' || nextStatus === 'NEEDS_REVIEW',
    } satisfies ClauseUpdate);

    const ok = await this.repo.updateClause(
      clauseId,
      actor.orgId,
      req.expectedVersion,
      update,
      this.audit(bidId, clauseId, 'CLAUSE_REVIEWED', actor, auditPayload, now),
      now,
    );
    if (!ok) {
      throw new ConflictError(
        'This clause was changed by someone else. Reload to see the changes.',
      );
    }
    await this.refreshBidCounters(bidId, actor.orgId, now);
    return this.detail(bidId, clauseId);
  }

  async bulkReview(
    bidId: string,
    req: BulkReviewRequest,
  ): Promise<{ confirmed: number; clauseIds: string[] }> {
    const actor = this.actor();
    await this.requireBid(bidId, actor.orgId);
    if (req?.action !== 'CONFIRM') {
      throw new BadRequestError('Bulk review only supports CONFIRM.');
    }
    const ids = [...new Set(req.clauseIds ?? [])];
    if (ids.length === 0) throw new BadRequestError('No clauses selected.');
    if (ids.length > MAX_BULK)
      throw new BadRequestError(`At most ${MAX_BULK} clauses per request.`);

    const { clauses } = await this.loadClauses(bidId, actor.orgId);
    const byId = new Map(clauses.map((c) => [c.id, c]));
    const rejected = ids
      .map((id) => {
        const c = byId.get(id);
        if (!c) return { id, reason: 'not found' };
        if (c.aiBand !== 'SPOT_CHECK') return { id, reason: `AI band ${c.aiBand}` };
        if (c.flags.length > 0) return { id, reason: `flagged: ${c.flags.join(', ')}` };
        if (c.review.status !== 'UNREVIEWED') return { id, reason: `already ${c.review.status}` };
        return null;
      })
      .filter((r): r is { id: string; reason: string } => r !== null);
    if (rejected.length > 0) {
      throw new UnprocessableError(
        `Bulk confirm only accepts unreviewed spot-check clauses without flags. Rejected ${rejected.length}: ` +
          rejected.map((r) => `${r.id} (${r.reason})`).join('; '),
      );
    }

    const now = new Date();
    const rows = ids.map((id) => {
      const c = byId.get(id) as Clause;
      return { id, version: c.review.version, status: 'PENDING' };
    });
    const ok = await this.repo.confirmClauses(
      rows,
      actor.orgId,
      {
        reviewStatus: 'CONFIRMED',
        reviewedBy: actor.userId,
        reviewedByName: actor.userName,
        reviewedAt: now,
        reviewNotes: null,
        humanReviewRequired: false,
      },
      this.audit(
        bidId,
        `bulk-${now.getTime()}`,
        'CLAUSES_BULK_CONFIRMED',
        actor,
        { clauseIds: ids },
        now,
      ),
      now,
    );
    if (!ok) {
      throw new ConflictError('Some clauses were changed by someone else. Reload and try again.');
    }
    await this.refreshBidCounters(bidId, actor.orgId, now);
    return { confirmed: ids.length, clauseIds: ids };
  }

  async resolveConflict(
    bidId: string,
    conflictId: string,
    req: ConflictResolutionRequest,
  ): Promise<Conflict> {
    const actor = this.actor();
    await this.requireBid(bidId, actor.orgId);
    const row = (await this.repo.listConflicts(bidId, actor.orgId)).find(
      (c) => c.id === conflictId,
    );
    if (!row) throw new NotFoundError(`Conflict '${conflictId}' not found.`);
    if (!RESOLUTIONS.includes(req?.resolution)) {
      throw new BadRequestError(`Unknown resolution '${String(req?.resolution)}'.`);
    }
    if (!Number.isInteger(req.expectedVersion))
      throw new BadRequestError('expectedVersion is required.');
    if (req.expectedVersion !== row.version) {
      throw new ConflictError(
        'This conflict was changed by someone else. Reload to see the changes.',
      );
    }
    const chosen = req.chosenClauseId ?? null;
    if (req.resolution === 'ACCEPTED_VALUE') {
      if (!chosen || !row.values.some((v) => v.clauseId === chosen)) {
        throw new UnprocessableError('Choose one of the conflicting clauses to accept its value.');
      }
    }
    const note = typeof req.note === 'string' && req.note.trim() ? req.note.trim() : null;
    if (req.resolution === 'RESOLVED_BY_CORRIGENDUM' && !note) {
      throw new UnprocessableError('Name the corrigendum that resolves this conflict.');
    }
    const now = new Date();
    const unresolved = req.resolution === 'UNRESOLVED';
    const ok = await this.repo.updateConflict(
      conflictId,
      actor.orgId,
      req.expectedVersion,
      {
        resolution: req.resolution,
        chosenClauseId: req.resolution === 'ACCEPTED_VALUE' ? chosen : null,
        note,
        resolvedBy: unresolved ? null : actor.userId,
        resolvedByName: unresolved ? null : actor.userName,
        resolvedAt: unresolved ? null : now,
      },
      this.audit(
        bidId,
        conflictId,
        'CONFLICT_RESOLVED',
        actor,
        { resolution: req.resolution, chosenClauseId: chosen, note },
        now,
      ),
      now,
    );
    if (!ok)
      throw new ConflictError(
        'This conflict was changed by someone else. Reload to see the changes.',
      );
    const updated = (await this.repo.listConflicts(bidId, actor.orgId)).find(
      (c) => c.id === conflictId,
    );
    return this.toConflict(updated as schema.ClauseConflictRow);
  }

  private audit(
    bidId: string,
    aggregateId: string,
    eventType: string,
    actor: Actor,
    payload: Record<string, unknown>,
    now: Date,
  ): schema.NewAuditLog {
    return {
      id: `aud-${eventType.toLowerCase()}-${randomUUID()}`,
      bidId,
      organizationId: actor.orgId,
      userId: actor.userId,
      userName: actor.userName,
      eventType,
      aggregateType: eventType.startsWith('CONFLICT') ? 'CLAUSE_CONFLICT' : 'CLAUSE',
      aggregateId,
      payload,
      timestamp: now,
    };
  }

  private async refreshBidCounters(bidId: string, orgId: string, now: Date): Promise<void> {
    const rows = await this.repo.listClauses(bidId, orgId);
    await this.repo.updateBidCounters(
      bidId,
      orgId,
      {
        totalRequirements: rows.length,
        flaggedRequirements: rows.filter(
          (r) => r.reviewStatus === 'NEEDS_REVIEW' || r.status === 'FAIL',
        ).length,
        approvedRequirements: rows.filter(
          (r) => r.reviewStatus === 'CONFIRMED' || r.reviewStatus === 'CORRECTED',
        ).length,
      },
      now,
    );
  }
}

/** Text before and after the quote on its page (null when the quote is not in the stored text). */
export function surroundingText(
  pageBlocks: string[],
  quote: string,
  span = 400,
): { before: string; after: string } | null {
  const text = pageBlocks.join('\n');
  const pos = text.indexOf(quote);
  if (pos < 0 || !quote) return null;
  return {
    before: text.slice(Math.max(0, pos - span), pos).trimStart(),
    after: text.slice(pos + quote.length, pos + quote.length + span).trimEnd(),
  };
}

export function buildCoverage(
  docs: schema.TenderDocument[],
  rows: schema.ExtractionCoverageRow[],
): Coverage {
  const byDoc = new Map(rows.map((r) => [r.documentId, r]));
  const documents = docs.map((d) => {
    const row = byDoc.get(d.id);
    let status: CoverageStatus;
    if (d.status === 'FAILED') status = 'FAILED';
    else if (d.status !== 'COMPLETED')
      status = d.status === 'UPLOADED' ? 'NOT_ANALYSED' : 'RUNNING';
    else status = row ? (row.status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETE') : 'UNKNOWN';
    return {
      id: d.id,
      name: d.fileName,
      pageCount: row?.pageCount ?? null,
      failedPages: row?.failedPages ?? [],
      status,
    };
  });
  const order: CoverageStatus[] = [
    'FAILED',
    'RUNNING',
    'PARTIAL',
    'UNKNOWN',
    'NOT_ANALYSED',
    'COMPLETE',
  ];
  const status =
    documents.length === 0
      ? 'NOT_ANALYSED'
      : (order.find((s) => documents.some((d) => d.status === s)) ?? 'COMPLETE');
  return { documents, status };
}

/** Applies reviewer corrections to the row update; returns the field diff for the audit log. */
function applyCorrections(
  row: schema.ComplianceItem,
  corrections: NonNullable<ClauseReviewRequest['corrections']>,
  update: ClauseUpdate,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const attrs = {
    ...EMPTY_ATTRIBUTES,
    ...((row.attributes as typeof EMPTY_ATTRIBUTES | null) ?? {}),
  };
  let attrsChanged = false;
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  if ('title' in corrections) {
    const title = String(corrections.title ?? '').trim();
    if (!title) throw new BadRequestError('Title cannot be empty.');
    if (title !== row.title) {
      diff.title = { from: row.title, to: title };
      update.title = title;
    }
  }
  if ('summary' in corrections) {
    const summary = corrections.summary ?? '';
    if (summary !== row.description) {
      diff.summary = { from: row.description, to: summary };
      update.description = summary;
    }
  }
  if ('clauseRef' in corrections) {
    const ref = corrections.clauseRef?.trim() || null;
    if (ref !== (row.clauseRef ?? null)) {
      diff.clauseRef = { from: row.clauseRef ?? null, to: ref };
      update.clauseRef = ref;
      update.provenance = {
        ...((row.provenance as Record<string, unknown>) ?? {}),
        clauseReference: ref,
        sectionOrClause: ref,
      };
    }
  }
  for (const key of [
    'obligationType',
    'action',
    'stage',
    'mandatory',
    'deadline',
    'amount',
    'formRef',
  ] as const) {
    if (key in corrections) {
      const value = (corrections as Record<string, unknown>)[key] ?? null;
      if (!same(value, attrs[key])) {
        diff[key] = { from: attrs[key], to: value };
        (attrs as Record<string, unknown>)[key] = value;
        attrsChanged = true;
      }
    }
  }
  if (attrsChanged) update.attributes = attrs;
  return diff;
}
