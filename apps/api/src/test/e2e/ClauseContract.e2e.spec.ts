/**
 * Phase 1 clause contract, API side (C1 + A1–A4 of the test plan).
 *
 * Ingests the golden AI event produced by apps/ai/tests/test_clause_contract.py through the
 * real completion webhook, then exercises the clause endpoints over HTTP.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import type {
  BidClauseSummary,
  ClauseDetail,
  ClauseListResponse,
  Conflict,
  Coverage,
  DocumentExtractionCompletedEvent,
  DocumentPageText,
} from '@tenderpulse/shared-types';
import { AppModule } from '@/app.module.js';
import { DRIZZLE_TOKEN, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { initDatabaseDdl } from '@/common/database/ddl.js';
import { mapLegacyStatus } from '@/modules/compliance/application/clause-model.js';

const GOLDEN = fileURLToPath(
  new URL(
    '../../../../../packages/shared-types/fixtures/extraction-completed.phase1.json',
    import.meta.url,
  ),
);
const ORG = 'org_acme_infra_001';
const COMPANY = 'comp_acme_infra_001';
const BID = 'bid-clause-contract';
const DOC = 'doc_fixture_nit';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || 'tenderpulse-internal-secret-2026';

function loadEvent(): DocumentExtractionCompletedEvent {
  const event = JSON.parse(readFileSync(GOLDEN, 'utf8')) as DocumentExtractionCompletedEvent;
  return {
    ...event,
    organizationId: ORG,
    companyId: COMPANY,
    bidId: BID,
    documentId: DOC,
  };
}

describe('Phase 1 clause contract (API)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let db: DrizzleDb;
  let manager: Record<string, string>;
  let viewer: Record<string, string>;

  const api = async <T>(
    path: string,
    init: RequestInit & { as?: Record<string, string> } = {},
  ): Promise<{ status: number; body: T; headers: Headers }> => {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.as ?? manager),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    return {
      status: res.status,
      body: (text ? JSON.parse(text) : undefined) as T,
      headers: res.headers,
    };
  };

  const ingest = async (event: DocumentExtractionCompletedEvent) =>
    fetch(`${baseUrl}/api/v1/internal/extraction-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': INTERNAL_KEY,
      },
      body: JSON.stringify(event),
    });

  const login = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' }),
    });
    const data = (await res.json()) as { accessToken: string };
    return { Authorization: `Bearer ${data.accessToken}` };
  };

  const listClauses = async () => (await api<ClauseListResponse>(`/bids/${BID}/clauses`)).body;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    const { AllExceptionsFilter } = await import('@/common/filters/all-exceptions.filter.js');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
    db = app.get<DrizzleDb>(DRIZZLE_TOKEN);

    const bcrypt = await import('bcrypt');
    const password = await bcrypt.hash('Password123!', 10);
    await db
      .insert(schema.organizations)
      .values({ id: ORG, name: 'Acme Infrastructure Ltd' })
      .onConflictDoNothing();
    await db
      .insert(schema.companies)
      .values({
        id: COMPANY,
        organizationId: ORG,
        legalName: 'Acme Infrastructure Pvt Ltd',
      })
      .onConflictDoNothing();
    for (const u of [
      {
        id: 'usr_clause_mgr',
        email: 'clause.manager@acme.com',
        name: 'Priya Sharma',
        role: 'BID_MANAGER',
        permissions: ['bids:read', 'bids:update', 'documents:read', 'compliance:review'],
      },
      {
        id: 'usr_clause_viewer',
        email: 'clause.viewer@acme.com',
        name: 'Read Only',
        role: 'VIEWER',
        permissions: ['bids:read', 'documents:read'],
      },
    ]) {
      await db
        .insert(schema.users)
        .values({
          ...u,
          password,
          organizationId: ORG,
          organizationName: 'Acme Infrastructure Ltd',
        })
        .onConflictDoUpdate({ target: schema.users.id, set: { password } });
    }
    // Fresh state for every run (the test database persists between runs).
    await db.delete(schema.bids).where(eq(schema.bids.id, BID));
    await db.delete(schema.auditLogs).where(eq(schema.auditLogs.bidId, BID));
    await db
      .insert(schema.bids)
      .values({
        id: BID,
        organizationId: ORG,
        companyId: COMPANY,
        title: 'Clause contract fixture',
        tenderNumber: 'FX-2026-1',
        tenderingAuthority: 'Fixture Authority',
        estimatedValueRupees: 500000,
        status: 'PROCESSING',
      })
      .onConflictDoNothing();
    await db
      .insert(schema.tenderDocuments)
      .values({
        id: DOC,
        bidId: BID,
        organizationId: ORG,
        fileName: 'Fixture_NIT_2026.pdf',
        storagePath: `tenants/${ORG}/bids/${BID}/${DOC}/Fixture_NIT_2026.pdf`,
        fileSizeBytes: 1000,
        mimeType: 'application/pdf',
        documentType: 'NIT',
        status: 'PROCESSING',
      })
      .onConflictDoNothing();

    manager = await login('clause.manager@acme.com');
    viewer = await login('clause.viewer@acme.com');

    const res = await ingest(loadEvent());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('COMPLETED');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('C1: the AI payload survives into the API without legacy defaults', async () => {
    const { clauses } = await listClauses();
    const text = JSON.stringify(clauses);
    for (const legacy of [
      'Authorized Signatory',
      'NIT Clause',
      'Clause Reference',
      'NIT_Document.pdf',
    ]) {
      expect(text).not.toContain(legacy);
    }
    for (const c of clauses) {
      expect(c.confidence.value).not.toBe(0.95);
      expect(c.sourceBlockId).toMatch(/^chk_doc_fixture_nit_p\d+$/);
      expect(Array.isArray(c.pages.supporting)).toBe(true);
    }
    const affidavit = clauses.find((c) => c.title === 'Non-blacklisting affidavit');
    expect(affidavit?.attestation).toEqual({
      stampPaper: true,
      stampDenominationInr: 10,
      notarised: true,
      udin: null,
      apostille: null,
      clientCountersign: null,
      signatoryRank: null,
    });
    const validity = clauses.find((c) => c.title === 'Bid validity');
    expect(validity?.clauseRef).toBeNull();
    expect(validity?.deadline).toEqual({
      kind: 'RELATIVE',
      date: null,
      anchor: 'BID_DUE',
      offsetDays: 120,
    });
    const udin = clauses.find((c) => c.title === 'Turnover certificate with UDIN');
    expect(udin?.formRef).toBe('Appendix XI');
    expect(udin?.parties).toEqual(['CA_AUDITOR']);
  });

  it('A1: clauses, conflicts and coverage are ingested as their own records', async () => {
    const { clauses, total, facets } = await listClauses();
    expect(total).toBe(9);
    expect(clauses.map((c) => c.clauseRef)).toEqual([
      '2.1',
      '3.1',
      '4.1',
      'A1.1',
      'A1.2',
      'A1.3',
      'SCC 7.1',
      null,
      '9.1',
    ]);
    const security = clauses.filter((c) => c.title === 'Performance Security');
    expect(security).toHaveLength(2);
    expect(new Set(security.map((c) => c.id)).size).toBe(2);
    expect(clauses.some((c) => /^(contradiction|ai-detected)/i.test(c.title))).toBe(false);

    const conflicts = (await api<Conflict[]>(`/bids/${BID}/conflicts`)).body;
    expect(conflicts).toHaveLength(2);
    const ids = new Set(clauses.map((c) => c.id));
    for (const conflict of conflicts) {
      expect(conflict.resolution).toBe('UNRESOLVED');
      for (const v of conflict.values) {
        expect(ids.has(v.clauseId)).toBe(true);
        expect(clauses.find((c) => c.id === v.clauseId)?.quote).toBe(v.quote);
      }
    }
    expect(facets.flags.CONFLICT).toBe(4);

    const coverage = (await api<Coverage>(`/bids/${BID}/coverage`)).body;
    expect(coverage.status).toBe('PARTIAL');
    expect(coverage.documents[0]?.failedPages).toEqual([
      { page: 7, reason: 'LLM_EXTRACTION_FAILED' },
    ]);
    const defect = clauses.find((c) => c.title === 'Defect liability period');
    expect(defect?.flags).toEqual(['NEAR_FAILED_PAGE']);
    expect(defect?.aiBand).toBe('REVIEW_REQUIRED');
  });

  it('A2: fresh clauses are unreviewed; legacy statuses migrate to the two axes', async () => {
    const { clauses } = await listClauses();
    expect(clauses.every((c) => c.review.status === 'UNREVIEWED')).toBe(true);
    expect(clauses.every((c) => c.fulfilment.status === 'NOT_STARTED')).toBe(true);

    // Migration dry run on a fresh database holding one row per legacy status.
    const pg = new PGlite();
    await initDatabaseDdl(pg);
    await pg.exec(`
      INSERT INTO organizations (id, name) VALUES ('o', 'o');
      INSERT INTO companies (id, organization_id, legal_name) VALUES ('c', 'o', 'c');
      INSERT INTO bids (id, organization_id, company_id, title, tender_number, tendering_authority, estimated_value_rupees)
        VALUES ('b', 'o', 'c', 't', 'n', 'a', 1);
      ALTER TABLE compliance_items DROP COLUMN review_status;
      ALTER TABLE compliance_items DROP COLUMN fulfilment_status;
      -- Databases built by the pre-migration DDL have no ledger, so the baseline runs on them.
      DROP TABLE schema_migrations;
    `);
    const legacy = [
      'PENDING',
      'READY',
      'FLAGGED',
      'WAIVED',
      'PASS',
      'FAIL',
      'MISSING',
      'REVIEW_REQUIRED',
      'NOT_APPLICABLE',
      'APPROVED',
      'REJECTED',
    ];
    let n = 0;
    for (const status of legacy) {
      for (const reviewer of [null, 'R. Mehta']) {
        n += 1;
        await pg.query(
          `INSERT INTO compliance_items (id, bid_id, organization_id, category, title, description, status, reviewed_by, execution_rules, provenance)
           VALUES ($1, 'b', 'o', 'LEGAL', $2, '', $3, $4, '{}', '{"pageNumber": 3}')`,
          [`ci-${n}`, `${status}-${reviewer ?? 'system'}`, status, reviewer],
        );
      }
    }
    await pg.exec(`
      INSERT INTO compliance_items (id, bid_id, organization_id, category, title, description, status, execution_rules, provenance)
      VALUES
        ('ref-1', 'b', 'o', 'LEGAL', 'r1', '', 'PENDING', '{}', '{"pageNumber": 3, "clauseReference": "ITB 15.2 (Pages 3, 4)"}'),
        ('ref-2', 'b', 'o', 'LEGAL', 'r2', '', 'PENDING', '{}', '{"pageNumber": 3, "clauseReference": "Page 3"}'),
        ('ref-3', 'b', 'o', 'LEGAL', 'r3', '', 'PENDING', '{}', '{"pageNumber": 3, "clauseReference": "Clause Reference"}');
    `);
    await initDatabaseDdl(pg); // the migration under test
    const refs = (
      await pg.query<{ id: string; clause_ref: string | null }>(
        "SELECT id, clause_ref FROM compliance_items WHERE id LIKE 'ref-%' ORDER BY id",
      )
    ).rows;
    expect(refs.map((r) => r.clause_ref)).toEqual(['ITB 15.2', null, null]);
    await pg.exec("DELETE FROM compliance_items WHERE id LIKE 'ref-%'");
    const rows = (
      await pg.query<{
        status: string;
        reviewed_by: string | null;
        review_status: string;
        fulfilment_status: string;
        primary_page: number;
      }>(
        'SELECT status, reviewed_by, review_status, fulfilment_status, primary_page FROM compliance_items',
      )
    ).rows;
    expect(rows).toHaveLength(legacy.length * 2);
    for (const r of rows) {
      expect(r.review_status).not.toBeNull();
      expect(r.fulfilment_status).not.toBeNull();
      expect(r.primary_page).toBe(3);
      const expected = mapLegacyStatus(r.status, Boolean(r.reviewed_by));
      expect({
        review: r.review_status,
        fulfilment: r.fulfilment_status,
      }).toEqual(expected);
    }
    // System-assigned statuses never survive as a review decision.
    for (const r of rows.filter((x) => !x.reviewed_by)) {
      expect(['UNREVIEWED', 'NEEDS_REVIEW']).toContain(r.review_status);
    }
    await pg.close();
  });

  it('A3: quotes are verified server-side against the stored page text', async () => {
    const { clauses } = await listClauses();
    expect(clauses.every((c) => c.quoteCheck === 'EXACT')).toBe(true);

    const page = (await api<DocumentPageText>(`/bids/${BID}/documents/${DOC}/pages/1`)).body;
    const pageText = page.blocks.map((b) => b.text).join('\n');
    for (const c of clauses.filter((x) => x.pages.primary === 1)) {
      expect(pageText).toContain(c.quote);
    }
    expect(pageText).not.toContain('SECTION SKELETON');

    // A tampered quote (not on the page) is flagged, never trusted.
    const event = loadEvent();
    const tampered = event.items.find((i) => i.title === 'Bid validity');
    if (!tampered) throw new Error('fixture changed');
    tampered.provenance.verbatimQuote =
      'The bid shall remain valid for 365 days from the bid due date.';
    expect((await ingest(event)).status).toBe(200);
    const after = (await listClauses()).clauses.find((c) => c.title === 'Bid validity');
    expect(after?.quoteCheck).toBe('NOT_FOUND');
    expect(after?.flags).toContain('QUOTE_NOT_FOUND');
    expect(after?.aiBand).toBe('REVIEW_REQUIRED');

    // Restore the real payload: same location identity, quote verified again.
    expect((await ingest(loadEvent())).status).toBe(200);
    const restored = (await listClauses()).clauses.find((c) => c.title === 'Bid validity');
    expect(restored?.id).toBe(after?.id);
    expect(restored?.quoteCheck).toBe('EXACT');
    expect(restored?.aiBand).toBe('SPOT_CHECK');
  });

  it('A4: review rules — forcing function, versions, reviewer identity, conflicts, bulk, permissions', async () => {
    let { clauses } = await listClauses();
    const originals = clauses.find((c) => c.title === 'Physical originals deadline');
    if (!originals) throw new Error('fixture changed');
    expect(originals.disqualifying).toBe(true);

    const review = (id: string, body: Record<string, unknown>, as = manager) =>
      api<ClauseDetail>(`/bids/${BID}/clauses/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(body),
        as,
      });

    // Read-only users cannot review.
    expect(
      (
        await review(
          originals.id,
          { action: 'CONFIRM', sourceOpened: true, expectedVersion: 1 },
          viewer,
        )
      ).status,
    ).toBe(403);
    // Disqualifying clause: confirming without opening the source is refused.
    const noSource = await review(originals.id, {
      action: 'CONFIRM',
      sourceOpened: false,
      expectedVersion: originals.review.version,
    });
    expect(noSource.status).toBe(422);
    // Stale version.
    expect(
      (
        await review(originals.id, {
          action: 'CONFIRM',
          sourceOpened: true,
          expectedVersion: originals.review.version + 5,
        })
      ).status,
    ).toBe(409);
    const ok = await review(originals.id, {
      action: 'CONFIRM',
      sourceOpened: true,
      expectedVersion: originals.review.version,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.review.status).toBe('CONFIRMED');
    expect(ok.body.review.by).toEqual({
      id: 'usr_clause_mgr',
      name: 'Priya Sharma',
    });
    expect(ok.body.history.map((h) => h.kind)).toEqual(['AI_EXTRACTED', 'CLAUSE_REVIEWED']);
    // Re-ingesting the same document keeps the human decision.
    expect((await ingest(loadEvent())).status).toBe(200);
    const kept = (await api<ClauseDetail>(`/bids/${BID}/clauses/${originals.id}`)).body;
    expect(kept.review.status).toBe('CONFIRMED');
    // Undo restores Unreviewed.
    const undo = await review(originals.id, {
      action: 'UNREVIEW',
      sourceOpened: false,
      expectedVersion: kept.review.version,
    });
    expect(undo.body.review.status).toBe('UNREVIEWED');
    expect(undo.body.review.by).toBeNull();

    // A clause in an unresolved conflict cannot be confirmed until the conflict is resolved.
    ({ clauses } = await listClauses());
    const emd = clauses.find((c) => c.title === 'Earnest Money Deposit');
    if (!emd) throw new Error('fixture changed');
    expect(emd.flags).toContain('CONFLICT');
    expect(
      (
        await review(emd.id, {
          action: 'CONFIRM',
          sourceOpened: true,
          expectedVersion: emd.review.version,
        })
      ).status,
    ).toBe(422);
    const conflict = (await api<Conflict[]>(`/bids/${BID}/conflicts`)).body.find(
      (c) => c.attribute === 'EMD amount',
    );
    if (!conflict) throw new Error('fixture changed');
    const resolved = await api<Conflict>(`/bids/${BID}/conflicts/${conflict.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        resolution: 'ACCEPTED_VALUE',
        chosenClauseId: emd.id,
        note: 'NIT governs over the appendix',
        expectedVersion: conflict.version,
      }),
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedBy?.name).toBe('Priya Sharma');
    const emdNow = (await api<ClauseDetail>(`/bids/${BID}/clauses/${emd.id}`)).body;
    expect(emdNow.flags).not.toContain('CONFLICT');
    expect(emdNow.conflicts[0]?.resolution).toBe('ACCEPTED_VALUE');
    expect(
      (
        await review(emd.id, {
          action: 'CONFIRM',
          sourceOpened: true,
          expectedVersion: emdNow.review.version,
        })
      ).status,
    ).toBe(200);

    // Correct: the diff is recorded and the clause is marked Corrected.
    const ps3 = clauses.find((c) => c.clauseRef === 'SCC 7.1');
    if (!ps3) throw new Error('fixture changed');
    const corrected = await review(ps3.id, {
      action: 'CORRECT',
      corrections: {
        title: 'Performance Security (SCC)',
        deadline: {
          kind: 'RELATIVE',
          date: null,
          anchor: 'LOA',
          offsetDays: 28,
        },
      },
      note: 'SCC sets the period',
      sourceOpened: true,
      expectedVersion: ps3.review.version,
    });
    expect(corrected.status).toBe(200);
    expect(corrected.body.review.status).toBe('CORRECTED');
    expect(corrected.body.title).toBe('Performance Security (SCC)');
    const event = corrected.body.history.at(-1);
    expect(event?.detail.diff).toMatchObject({
      title: { from: 'Performance Security', to: 'Performance Security (SCC)' },
    });

    // Bulk confirm is all-or-nothing and only for unreviewed spot-check clauses.
    ({ clauses } = await listClauses());
    const spot = clauses.filter(
      (c) => c.aiBand === 'SPOT_CHECK' && c.review.status === 'UNREVIEWED',
    );
    const notSpot = clauses.find(
      (c) => c.aiBand !== 'SPOT_CHECK' && c.review.status === 'UNREVIEWED',
    );
    expect(spot.length).toBeGreaterThan(0);
    if (!notSpot) throw new Error('fixture changed');
    const rejected = await api(`/bids/${BID}/clauses/bulk-review`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'CONFIRM',
        clauseIds: [...spot.map((c) => c.id), notSpot.id],
      }),
    });
    expect(rejected.status).toBe(422);
    expect(
      (await listClauses()).clauses.filter((c) => c.review.status === 'CONFIRMED'),
    ).toHaveLength(1);
    const accepted = await api<{ confirmed: number }>(`/bids/${BID}/clauses/bulk-review`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'CONFIRM',
        clauseIds: spot.map((c) => c.id),
      }),
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.confirmed).toBe(spot.length);
  });

  it('serves the summary and supports conditional list requests', async () => {
    const summary = (await api<BidClauseSummary>(`/bids/${BID}/summary`)).body;
    expect(summary.clauses).toBe(9);
    expect(summary.conflicts).toEqual({ total: 2, unresolved: 1 });
    expect(summary.pagesNotAnalysed).toBe(1);
    expect(summary.attention.needsOutsideParty).toBe(3); // bank, notary, CA
    expect(summary.deadlines.map((d) => d.deadline.kind).sort()).toEqual([
      'ABSOLUTE',
      'RELATIVE',
      'RELATIVE',
      'RELATIVE',
    ]);

    const first = await api<ClauseListResponse>(`/bids/${BID}/clauses`);
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    const again = await fetch(`${baseUrl}/api/v1/bids/${BID}/clauses`, {
      headers: { ...manager, 'If-None-Match': etag as string },
    });
    expect(again.status).toBe(304);

    // Tenant isolation: unknown bid.
    expect((await api(`/bids/bid-does-not-exist/clauses`)).status).toBe(404);
  });
});
