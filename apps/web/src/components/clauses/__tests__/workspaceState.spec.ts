import { describe, expect, it } from 'vitest';
import type { Clause } from '@tenderpulse/shared-types';
import {
  DEFAULT_VIEW,
  bulkEligible,
  filterClauses,
  groupClauses,
  parseView,
  presetCounts,
  sectionOf,
  serializeView,
} from '../workspaceState.js';
import {
  attestationChips,
  formatAmount,
  formatDeadline,
  notStatedFields,
  refLabel,
} from '../clauseFormat.js';
import { locate } from '../SourceViewer.js';

function clause(over: Partial<Clause> = {}): Clause {
  return {
    id: 'c1',
    bidId: 'b',
    documentId: 'd',
    documentName: 'NIT.pdf',
    docOrder: 0,
    title: 'Bid validity',
    summary: 'Valid 120 days',
    quote: 'The bid shall remain valid for 120 days.',
    quoteCheck: 'EXACT',
    pages: { primary: 5, supporting: [] },
    clauseRef: null,
    sourceBlockId: null,
    category: 'LEGAL',
    obligationType: null,
    action: null,
    stage: null,
    parties: [],
    mandatory: null,
    disqualifying: null,
    deadline: null,
    amount: null,
    formRef: null,
    attestation: {
      stampPaper: null,
      stampDenominationInr: null,
      notarised: null,
      udin: null,
      apostille: null,
      clientCountersign: null,
      signatoryRank: null,
    },
    aiBand: 'SPOT_CHECK',
    confidence: { value: 1, source: 'VALIDATION' },
    flags: [],
    conflictIds: [],
    review: { status: 'UNREVIEWED', by: null, at: null, note: null, version: 1 },
    fulfilment: { status: 'NOT_STARTED', ownerId: null },
    ...over,
  };
}

describe('workspace view state', () => {
  it('round-trips through the URL and drops defaults', () => {
    const view = {
      ...DEFAULT_VIEW,
      preset: 'dq' as const,
      review: ['NEEDS_REVIEW' as const],
      clause: 'c9',
      verify: true,
    };
    const params = serializeView(view);
    expect(params.toString()).toBe('view=dq&review=NEEDS_REVIEW&clause=c9&verify=1');
    expect(parseView(params)).toEqual(view);
    expect(parseView(new URLSearchParams('view=bogus&group=nope'))).toEqual(DEFAULT_VIEW);
  });

  it('filters by preset, facets and search, and hides dismissed clauses unless asked', () => {
    const items = [
      clause({ id: 'a', disqualifying: true, aiBand: 'CHECK_CAREFULLY' }),
      clause({ id: 'b', flags: ['CONFLICT'], aiBand: 'REVIEW_REQUIRED', title: 'EMD amount' }),
      clause({
        id: 'c',
        review: { status: 'NOT_A_REQUIREMENT', by: null, at: null, note: null, version: 2 },
      }),
    ];
    const ids = (v: Partial<typeof DEFAULT_VIEW>) =>
      filterClauses(items, { ...DEFAULT_VIEW, ...v }).map((c) => c.id);
    expect(ids({})).toEqual(['a', 'b']);
    expect(ids({ dismissed: true })).toEqual(['a', 'b', 'c']);
    expect(ids({ preset: 'dq' })).toEqual(['a']);
    expect(ids({ preset: 'conflict' })).toEqual(['b']);
    expect(ids({ preset: 'needs' })).toEqual(['b']);
    expect(ids({ q: 'emd' })).toEqual(['b']);
    expect(ids({ band: ['CHECK_CAREFULLY'] })).toEqual(['a']);
    expect(presetCounts(items)).toMatchObject({ all: 3, dq: 1, conflict: 1, needs: 1 });
  });

  it('groups by the tender’s own section numbers in reading order', () => {
    expect(sectionOf(clause({ clauseRef: '2.1' }))).toBe('Clause 2');
    expect(sectionOf(clause({ clauseRef: 'SCC 7.1' }))).toBe('SCC 7');
    expect(sectionOf(clause({ clauseRef: 'A1.2' }))).toBe('Clause A1');
    expect(sectionOf(clause({ clauseRef: '(k)' }))).toBe('(k)');
    expect(sectionOf(clause({ clauseRef: null }))).toBe('Unnumbered clauses');
    const groups = groupClauses(
      [
        clause({ id: '1', clauseRef: '2.1' }),
        clause({ id: '2', clauseRef: '2.2', flags: ['CONFLICT'] }),
        clause({ id: '3', clauseRef: '3.1' }),
      ],
      'section',
    );
    expect(groups.map((g) => [g.name, g.clauses.length, g.conflicts])).toEqual([
      ['Clause 2', 2, 1],
      ['Clause 3', 1, 0],
    ]);
  });

  it('only offers clean spot-check clauses for bulk confirm', () => {
    expect(bulkEligible(clause())).toBe(true);
    expect(bulkEligible(clause({ flags: ['NEAR_FAILED_PAGE'] }))).toBe(false);
    expect(bulkEligible(clause({ aiBand: 'CHECK_CAREFULLY' }))).toBe(false);
  });
});

describe('clause display text', () => {
  it('shows only what the clause states', () => {
    const c = clause({
      attestation: {
        ...clause().attestation,
        stampPaper: true,
        stampDenominationInr: 10,
        notarised: true,
        udin: false,
      },
    });
    expect(attestationChips(c)).toEqual(['Stamp ₹10', 'Notarised']);
    expect(refLabel(clause())).toBe('No clause no. · p.5');
    expect(notStatedFields(clause())).toContain('clause number');
    expect(formatAmount({ inr: 1250000, percent: null, basis: null })).toBe('₹12.5 L');
    expect(formatAmount({ inr: null, percent: 3, basis: null })).toBe('3%, base not stated');
    expect(formatDeadline({ kind: 'RELATIVE', date: null, anchor: 'LOA', offsetDays: 30 })).toBe(
      '30 days after LOA',
    );
    expect(formatDeadline(null)).toBe('Not stated');
  });

  it('locates a quote in page text despite whitespace differences', () => {
    expect(locate('2.1 The bidder shall\npay EMD.', 'The bidder shall pay EMD.')).toEqual([4, 29]);
    expect(locate('nothing here', 'The bidder shall pay')).toBeNull();
  });
});
