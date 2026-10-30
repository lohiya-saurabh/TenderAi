import { describe, it, expect } from 'vitest';
import { evidenceNeed, matchClauseEvidence, type MatchContext } from './clause-evidence-matcher.js';

const doc = (id: string, verificationStatus: string) =>
  ({ id, verificationStatus, evidenceType: 'X', fileName: `${id}.pdf` }) as never;

const ctx = (extra: Partial<MatchContext> = {}): MatchContext => ({
  profile: {
    company_name: 'Acme',
    turnover_records: [
      {
        entry_id: 't1',
        financial_year: '2024-25',
        turnover_inr_crores: 320,
        evidence_document_id: 'ev_t',
      },
    ],
    certifications: [
      {
        entry_id: 'c1',
        standard_name: 'ISO 9001:2015',
        issuing_body: 'BV',
        valid_from: '2024-01-01',
        valid_to: '2026-06-30',
        evidence_document_id: 'ev_c',
      },
    ],
  },
  evidenceById: new Map([
    ['ev_t', doc('ev_t', 'SOURCE_VERIFIED')],
    ['ev_c', doc('ev_c', 'EXTRACTED')],
  ]),
  company: null,
  deadline: new Date('2026-11-30'),
  ...extra,
});

describe('clause-evidence matcher', () => {
  it('classifies what a clause asks for from its own words', () => {
    expect(evidenceNeed('Average annual turnover of Rs. 50 crore')).toBe('TURNOVER');
    expect(evidenceNeed('completed at least one similar work of value')).toBe('SIMILAR_WORK');
    expect(evidenceNeed('Valid ISO 9001 certificate')).toBe('CERTIFICATE');
    expect(evidenceNeed('The pre-bid meeting will be held on 4 Nov')).toBeNull();
  });

  it('links verified turnover evidence, and reports missing work as null', () => {
    expect(matchClauseEvidence('minimum turnover', ctx())?.status).toBe('VERIFIED');
    expect(matchClauseEvidence('similar works completed', ctx())).toBeNull();
    expect(matchClauseEvidence('pre-bid meeting', ctx())).toBeUndefined();
  });

  it('marks a certificate expiring before the bid deadline as expired', () => {
    const m = matchClauseEvidence('Valid ISO 9001 certification required', ctx());
    expect(m?.status).toBe('EXPIRED');
    expect(matchClauseEvidence('ISO 14001 certificate', ctx())).toBeNull();
  });
});
