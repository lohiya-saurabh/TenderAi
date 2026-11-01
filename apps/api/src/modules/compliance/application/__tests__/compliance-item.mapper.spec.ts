import { describe, it, expect } from 'vitest';
import { mapComplianceRecord } from '../compliance-item.mapper.js';
import type * as schema from '@/common/database/schema.js';

describe('compliance-item.mapper', () => {
  const baseRecord: schema.ComplianceItem = {
    id: 'comp_1',
    bidId: 'bid_1',
    category: 'TECHNICAL',
    title: 'Experience Criteria',
    description: 'Must have completed similar work',
    status: 'PASS',
    humanReviewRequired: false,
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    version: 1,
    executionRules: JSON.stringify({
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Director',
    }),
    provenance: JSON.stringify({
      documentName: 'NIT.pdf',
      pageNumber: 4,
      clauseReference: 'Clause 4.1.3 (Page 6)',
      verbatimQuote: 'Must have completed \n similar road projects \n of Rs 50 Cr.',
      confidenceScore: 0.95,
    }),
    companyEvidence: null,
    risk: null,
    rationale: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('strips trailing page annotations from clauseReference', () => {
    const dto = mapComplianceRecord(baseRecord);
    expect(dto.tenderClauseRef).toBe('4.1.3');
  });

  it('drops generic page fallback "Clause on Page 4" and returns undefined', () => {
    const record = {
      ...baseRecord,
      provenance: JSON.stringify({
        clauseReference: 'Clause on Page 4',
      }),
    };
    const dto = mapComplianceRecord(record as schema.ComplianceItem);
    expect(dto.tenderClauseRef).toBeUndefined();
  });

  it('drops generic page fallback "Clauses across Pages 2, 18" and returns undefined', () => {
    const record = {
      ...baseRecord,
      provenance: JSON.stringify({
        clauseReference: 'Clauses across Pages 2, 18',
      }),
    };
    const dto = mapComplianceRecord(record as schema.ComplianceItem);
    expect(dto.tenderClauseRef).toBeUndefined();
  });

  it('drops bare page fallback "Page 4" and "Pages 2, 6" and returns undefined', () => {
    const rec1 = {
      ...baseRecord,
      provenance: JSON.stringify({
        clauseReference: 'Page 4',
      }),
    };
    expect(mapComplianceRecord(rec1 as schema.ComplianceItem).tenderClauseRef).toBeUndefined();

    const rec2 = {
      ...baseRecord,
      provenance: JSON.stringify({
        clauseReference: 'Pages 2, 6',
      }),
    };
    expect(mapComplianceRecord(rec2 as schema.ComplianceItem).tenderClauseRef).toBeUndefined();
  });

  it('preserves named schedules while stripping page annotations', () => {
    const record = {
      ...baseRecord,
      provenance: JSON.stringify({
        clauseReference: 'Schedule G (Pages 12, 14)',
      }),
    };
    const dto = mapComplianceRecord(record as schema.ComplianceItem);
    expect(dto.tenderClauseRef).toBe('Schedule G');
  });

  it('normalizes internal newlines in sourceCitation verbatim quote', () => {
    const dto = mapComplianceRecord(baseRecord);
    expect(dto.sourceCitation?.verbatimQuote).toBe(
      'Must have completed similar road projects of Rs 50 Cr.',
    );
    expect(dto.sourceCitation?.verbatimQuote).not.toContain('\n');
  });
});
