/**
 * Seeds tenders for the clause workspace tests: a bid, an uploaded PDF that names the bid,
 * and the AI's completion event delivered through the real webhook.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Page } from '@playwright/test';

export const API = 'http://localhost:3000/api/v1';
/** Generated per run in playwright.config.ts and passed to the test API. */
const INTERNAL_KEY = process.env.E2E_INTERNAL_KEY ?? '';
const here = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN = path.join(here, '../../packages/shared-types/fixtures/extraction-completed.phase1.json');

export const USERS = {
  manager: { email: 'bidmanager@acme.com', password: 'Password123!' },
  readOnly: { email: 'auditor@acme.com', password: 'Password123!' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompletionEvent = Record<string, any>;

export function goldenEvent(): CompletionEvent {
  return JSON.parse(readFileSync(GOLDEN, 'utf8'));
}

function pdfNaming(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = lines.map((l, i) => `BT /F1 11 Tf 72 ${760 - i * 16} Td (${esc(l)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

export async function apiLogin(request: APIRequestContext, user = USERS.manager) {
  const res = await request.post(`${API}/auth/login`, { data: user });
  const body = await res.json();
  const token: string = body.accessToken;
  const claims = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
  return { headers: { Authorization: `Bearer ${token}` }, organizationId: claims.organizationId as string };
}

/** Creates a bid, uploads a PDF naming it, and ingests `event` for that document. */
export async function seedTender(
  request: APIRequestContext,
  title: string,
  event: CompletionEvent,
): Promise<{ bidId: string; documentId: string }> {
  const { headers, organizationId } = await apiLogin(request);
  const tenderNumber = `E2E/${Date.now()}/${Math.floor(Math.random() * 1e6)}`;
  const created = await request.post(`${API}/bids`, {
    headers,
    data: {
      companyId: 'comp_acme_infra_001',
      title,
      tenderNumber,
      tenderingAuthority: 'Fixture Works Authority',
      estimatedValueRupees: 500000,
    },
  });
  if (!created.ok()) throw new Error(`create bid: ${created.status()} ${await created.text()}`);
  const { bidId } = await created.json();

  const pdf = pdfNaming([
    `Notice Inviting Tender: ${title}`,
    `Tender Number: ${tenderNumber}`,
    'Tendering Authority: Fixture Works Authority',
  ]);
  const up = await request.post(`${API}/bids/${bidId}/upload-url`, {
    headers,
    data: { fileName: 'Fixture_NIT_2026.pdf', mimeType: 'application/pdf', sizeBytes: pdf.length },
  });
  const { documentId, uploadUrl } = await up.json();
  const put = await request.put(uploadUrl, { data: pdf });
  if (!put.ok()) throw new Error(`upload: ${put.status()}`);
  const confirm = await request.post(`${API}/bids/${bidId}/documents/confirm`, {
    headers,
    data: { documentId },
  });
  if (!confirm.ok()) throw new Error(`confirm: ${confirm.status()} ${await confirm.text()}`);

  const payload = {
    ...event,
    organizationId,
    companyId: 'comp_acme_infra_001',
    bidId,
    documentId,
    chunks: (event.chunks ?? []).map((c: CompletionEvent) => ({
      ...c,
      id: `${c.id}_${documentId}`,
      chunkId: `${c.id}_${documentId}`,
    })),
  };
  const done = await request.post(`${API}/internal/extraction-completed`, {
    headers: { 'x-internal-service-key': INTERNAL_KEY },
    data: payload,
  });
  const result = await done.json();
  if (result.status !== 'COMPLETED') throw new Error(`ingest: ${JSON.stringify(result)}`);
  return { bidId, documentId };
}

/** A large synthetic tender: `n` clauses over n/10 pages, page text stored for every quote. */
export function scaleEvent(n: number): CompletionEvent {
  const base = goldenEvent();
  const items = [];
  const chunks = [];
  const perPage = 10;
  for (let p = 1; p <= Math.ceil(n / perPage); p++) {
    const lines: string[] = [];
    for (let k = 0; k < perPage && items.length < n; k++) {
      const i = items.length;
      const quote = `${p}.${k + 1} The Contractor shall comply with requirement number ${i + 1} of this tender.`;
      lines.push(quote);
      items.push({
        itemKey: `cl_${(i + 1).toString(16).padStart(24, '0')}`,
        docOrder: i,
        category: ['LEGAL', 'TECHNICAL', 'FINANCIAL'][i % 3],
        title: `Requirement ${i + 1}`,
        description: `Comply with requirement ${i + 1}.`,
        executionRules: {},
        attributes: {
          obligationType: i % 7 === 0 ? 'DOCUMENT' : 'COVENANT',
          action: null,
          stage: i % 5 === 0 ? 'WITH_BID_ONLINE' : 'EXECUTION',
          parties: [],
          mandatory: 'MANDATORY',
          disqualifying: i % 50 === 0 ? true : null,
          deadline: null,
          amount: null,
          formRef: null,
        },
        provenance: {
          sourceDocumentId: 'doc_scale',
          sourceFileName: 'Scale.pdf',
          pageNumber: p,
          supportingPages: [],
          clauseReference: `${p}.${k + 1}`,
          sourceBlockId: null,
          verbatimQuote: quote.slice(quote.indexOf(' ') + 1),
          confidenceScore: i % 4 === 0 ? 0.85 : 1,
        },
        flags: [],
        verificationStatus: 'VERIFIED',
      });
    }
    chunks.push({ id: `chk_scale_p${p}`, chunkIndex: p, chunkType: 'CLAUSE', content: lines.join('\n'), pageNumber: p });
  }
  return { ...base, items, chunks, conflicts: [], coverage: { documentId: 'doc_scale', pageCount: Math.ceil(n / perPage), failedPages: [], status: 'COMPLETE' } };
}

export async function uiLogin(page: Page, user = USERS.manager) {
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids');
}

/** In-app navigation (keeps the in-memory session; a full reload would sign out). */
export async function navigate(page: Page, url: string) {
  await page.evaluate((u) => {
    window.history.pushState({}, '', u);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);
}
