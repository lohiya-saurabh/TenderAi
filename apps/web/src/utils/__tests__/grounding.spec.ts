import { describe, it, expect } from 'vitest';
import { deriveGroundingMatch } from '../grounding.js';

describe('deriveGroundingMatch — Deterministic Citation Verification', () => {
  it('returns 100% Verbatim Grounding when all 4 coordinates are verified and present', () => {
    const item = {
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 12,
        sectionOrClause: 'Section II — ITB Clause 2.2.2.1',
        verbatimQuote: 'The Bidder must have successfully completed as a prime contractor at least one similar highway project.',
        confidenceScore: 0.96,
      },
    };

    const derivation = deriveGroundingMatch(item);
    expect(derivation.matchPct).toBe(100);
    expect(derivation.isExactVerbatim).toBe(true);
    expect(derivation.badgeLabel).toBe('100% Verbatim Grounding');
    expect(derivation.citationNote).toContain('Page 12');
    expect(derivation.citationNote).toContain('Notice_Inviting_Tender_Vol_I.pdf');
  });

  it('derives proportional match score when citations are missing coordinates', () => {
    const item = {
      provenance: {
        pageNumber: 0,
        verbatimQuote: 'Short text',
      },
      sourceCitation: null,
    };

    const derivation = deriveGroundingMatch(item);
    expect(derivation.isExactVerbatim).toBe(false);
    expect(derivation.matchPct).toBeLessThan(100);
    expect(derivation.badgeLabel).toContain('% Grounding Match');
  });
});
