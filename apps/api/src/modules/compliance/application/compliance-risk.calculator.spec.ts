import { describe, it, expect } from 'vitest';
import { buildRiskFindings, type ClauseRiskSignals } from './compliance-risk.calculator.js';

const item = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    category: 'FINANCIAL',
    title: `Clause ${id}`,
    description: '',
    status: 'PENDING',
    provenance: { sectionOrClause: '4.1' },
    ...extra,
  }) as never;

describe('buildRiskFindings — from what extraction records', () => {
  it('derives levels from grounded attributes and flags, with stated amounts only', () => {
    const signals = new Map<string, ClauseRiskSignals>([
      ['a', { attributes: { disqualifying: true }, flags: [] }],
      ['b', { attributes: { obligationType: 'PENALTY', amount: { inr: 500000 } }, flags: [] }],
      ['c', { attributes: null, flags: ['CONFLICT'] }],
      ['d', { attributes: { obligationType: 'INFO' }, flags: [] }],
    ]);
    const result = buildRiskFindings(
      'bid-1',
      'NIT-1',
      [item('a'), item('b'), item('c'), item('d')],
      null,
      signals,
    );
    const levels = Object.fromEntries(
      result.statutoryRisks.map((r) => [r.complianceItemId, r.level]),
    );
    expect(levels).toEqual({ a: 'CRITICAL', b: 'HIGH', c: 'HIGH' });
    expect(result.summary.estimatedFinancialExposureRupees).toBe(500000);
  });

  it('never assumes a stamp-paper denomination', () => {
    const result = buildRiskFindings(
      'bid-1',
      'NIT-1',
      [item('a', { executionRules: { stampPaperRequired: true } })],
      null,
      new Map([['a', { attributes: { disqualifying: true }, flags: [] }]]),
    );
    expect(result.statutoryRisks[0]!.executionConstraints[0]).toContain('denomination not stated');
  });
});
