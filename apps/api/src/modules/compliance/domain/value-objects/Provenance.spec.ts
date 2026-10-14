import { describe, it, expect } from 'vitest';
import { InvalidProvenanceException } from '../../../../common/domain/DomainException.js';
import { Provenance } from './Provenance.js';

describe('Provenance Value Object', () => {
  const validProps = {
    sourceDocumentId: 'doc-uuid-1',
    sourceFileName: 'NIT_NHAI_Vol_1.pdf',
    pageNumber: 42,
    clauseReference: 'Section 4, Clause 12.3',
    verbatimQuote:
      'The bidder must submit an affidavit on non-judicial stamp paper of minimum Rs. 100.',
    confidenceScore: 0.95,
  };

  it('should successfully instantiate a valid Provenance and freeze it', () => {
    const provenance = new Provenance(validProps);

    expect(provenance.sourceDocumentId).toBe('doc-uuid-1');
    expect(provenance.sourceFileName).toBe('NIT_NHAI_Vol_1.pdf');
    expect(provenance.pageNumber).toBe(42);
    expect(provenance.clauseReference).toBe('Section 4, Clause 12.3');
    expect(provenance.confidenceScore).toBe(0.95);
    expect(Object.isFrozen(provenance)).toBe(true);
  });

  it('should throw InvalidProvenanceException if verbatim quote is empty', () => {
    expect(() => new Provenance({ ...validProps, verbatimQuote: '   ' })).toThrow(
      InvalidProvenanceException,
    );
  });

  it('should throw InvalidProvenanceException if page number is less than 1', () => {
    expect(() => new Provenance({ ...validProps, pageNumber: 0 })).toThrow(
      InvalidProvenanceException,
    );
    expect(() => new Provenance({ ...validProps, pageNumber: -5 })).toThrow(
      InvalidProvenanceException,
    );
  });

  it('should throw InvalidProvenanceException if confidence score is out of [0.0, 1.0]', () => {
    expect(() => new Provenance({ ...validProps, confidenceScore: 1.5 })).toThrow(
      InvalidProvenanceException,
    );
    expect(() => new Provenance({ ...validProps, confidenceScore: -0.1 })).toThrow(
      InvalidProvenanceException,
    );
  });
});
