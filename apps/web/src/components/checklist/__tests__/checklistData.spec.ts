import { describe, expect, it } from 'vitest';
import type { Clause } from '@tenderpulse/shared-types';
import { buildChecklist } from '../checklistData.js';

function clause(over: Partial<Clause> = {}): Clause {
  return {
    id: 'c1',
    bidId: 'b',
    documentId: 'd',
    documentName: 'NIT.pdf',
    docOrder: 0,
    title: 'Turnover certificate',
    summary: null,
    quote: 'q',
    quoteCheck: 'EXACT',
    pages: { primary: 5, supporting: [] },
    clauseRef: null,
    sourceBlockId: null,
    category: 'FINANCIAL',
    obligationType: 'DOCUMENT',
    action: 'ATTACH_DOCUMENT',
    stage: 'WITH_BID_ONLINE',
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

describe('documents checklist', () => {
  it('keeps only document clauses and drops ones marked not a requirement', () => {
    const { total } = buildChecklist([
      clause({ id: 'doc' }),
      clause({ id: 'info', obligationType: 'INFO', action: 'INFO_ONLY' }),
      clause({
        id: 'dismissed',
        review: { status: 'NOT_A_REQUIREMENT', by: null, at: null, note: null, version: 2 },
      }),
    ]);
    expect(total).toBe(1);
  });

  it('groups by stage in submission order, with unstated stage last', () => {
    const { groups } = buildChecklist([
      clause({ id: 'a', stage: 'POST_AWARD' }),
      clause({ id: 'b', stage: null }),
      clause({ id: 'c', stage: 'WITH_BID_PHYSICAL' }),
      clause({ id: 'd', stage: 'PRE_BID' }),
    ]);
    expect(groups.map((g) => g.stage)).toEqual([
      'PRE_BID',
      'WITH_BID_PHYSICAL',
      'POST_AWARD',
      'NOT_STATED',
    ]);
    expect(groups.at(-1)?.label).toBe('Stage not stated');
  });

  it('counts only done documents as ready', () => {
    const result = buildChecklist([
      clause({ id: 'a', fulfilment: { status: 'DONE', ownerId: null } }),
      clause({ id: 'b', fulfilment: { status: 'EVIDENCE_ATTACHED', ownerId: null } }),
      clause({ id: 'c' }),
    ]);
    expect(result.ready).toBe(1);
    expect(result.groups[0]?.ready).toBe(1);
  });
});
