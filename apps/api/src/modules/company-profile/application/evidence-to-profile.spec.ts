import { describe, it, expect } from 'vitest';
import { mergeEvidenceIntoProfile } from './evidence-to-profile.js';

const evidence = (attrs: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({
    id: 'ev_1',
    fileName: 'doc.pdf',
    issuer: null,
    validFrom: null,
    validTo: null,
    extractedAttributes: attrs,
    ...extra,
  }) as never;

describe('mergeEvidenceIntoProfile', () => {
  it('adds turnover per year and replaces the same year', () => {
    const base = {
      company_name: 'Acme',
      turnover_records: [
        {
          entry_id: 'old',
          financial_year: '2023-24',
          turnover_inr_crores: 1,
          evidence_document_id: 'x',
        },
      ],
    };
    const { payload, added } = mergeEvidenceIntoProfile(
      base,
      evidence({
        turnover_by_fy: { '2023-24': 280.5, '2024-25': 320.5 },
        udin: '25089745AAAAAA1234',
      }),
    );
    expect(payload.turnover_records).toHaveLength(2);
    expect(
      payload.turnover_records?.find((r) => r.financial_year === '2023-24')?.turnover_inr_crores,
    ).toBe(280.5);
    expect(payload.turnover_records?.[0]?.ca_udin).toBe('25089745AAAAAA1234');
    expect(added).toHaveLength(2);
    expect(base.turnover_records[0]?.turnover_inr_crores).toBe(1); // base untouched
  });

  it('skips a project whose completion date the document does not state', () => {
    const { payload, added, skipped } = mergeEvidenceIntoProfile(
      { company_name: 'Acme' },
      evidence({ project_name: 'STRR', client_name: 'NHAI', contract_value_inr_cr: 215 }),
    );
    expect(payload.experience).toBeUndefined();
    expect(added).toEqual([]);
    expect(skipped[0]).toContain('completion date not stated');
  });

  it('adds a stated certificate with its validity', () => {
    const { payload } = mergeEvidenceIntoProfile(
      { company_name: 'Acme' },
      evidence({
        standard: 'ISO 9001:2015',
        issuer: 'Bureau Veritas',
        valid_from: '01/04/2024',
        valid_to: '31/03/2027',
      }),
    );
    expect(payload.certifications?.[0]).toMatchObject({
      standard_name: 'ISO 9001:2015',
      issuing_body: 'Bureau Veritas',
      valid_from: '2024-04-01',
      valid_to: '2027-03-31',
    });
  });
});
