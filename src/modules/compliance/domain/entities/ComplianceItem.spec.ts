import { describe, it, expect } from 'vitest';
import { ValidationException } from '../../../../common/domain/DomainException.js';
import { ComplianceItem } from './ComplianceItem.js';
import { ComplianceStatus } from '../value-objects/ComplianceStatus.js';
import { ExecutionRules } from '../value-objects/ExecutionRules.js';
import { Provenance } from '../value-objects/Provenance.js';

describe('ComplianceItem Domain Aggregate', () => {
  const provenance = new Provenance({
    sourceDocumentId: 'doc-uuid-1',
    sourceFileName: 'NIT_Road_Vol_1.pdf',
    pageNumber: 18,
    clauseReference: 'Clause 4.1',
    verbatimQuote: 'Bidder must submit audited balance sheets for last 3 financial years.',
    confidenceScore: 0.98,
  });

  const executionRules = new ExecutionRules({
    stampPaperRequired: false,
    notarizationRequired: false,
    udinRequired: true,
  });

  const validProps = {
    id: 'item-uuid-1',
    bidId: 'bid-uuid-1',
    organizationId: 'org-abc',
    category: 'FINANCIAL_CRITERIA',
    title: 'Audited Balance Sheets (3 FYs)',
    description: 'Requires CA certified balance sheets with UDIN.',
    executionRules,
    provenance,
  };

  it('should instantiate in PENDING status with version 1', () => {
    const item = new ComplianceItem(validProps);

    expect(item.id).toBe('item-uuid-1');
    expect(item.status.value).toBe('PENDING');
    expect(item.version).toBe(1);
    expect(item.userNotes).toBeNull();
    expect(item.reviewedAt).toBeNull();
  });

  it('should successfully update review status to READY and increment version', () => {
    const item = new ComplianceItem(validProps);

    item.updateReview(ComplianceStatus.READY, 'Balance sheets verified by CA', 'user-44');

    expect(item.status.value).toBe('READY');
    expect(item.userNotes).toBe('Balance sheets verified by CA');
    expect(item.assignedUserId).toBe('user-44');
    expect(item.version).toBe(2);
    expect(item.reviewedAt).not.toBeNull();
  });

  it('should require notes when status is changed to FLAGGED or WAIVED', () => {
    const item = new ComplianceItem(validProps);

    expect(() => item.updateReview(ComplianceStatus.FLAGGED, '')).toThrow(ValidationException);
    expect(() => item.updateReview(ComplianceStatus.WAIVED, '   ')).toThrow(ValidationException);
  });
});
