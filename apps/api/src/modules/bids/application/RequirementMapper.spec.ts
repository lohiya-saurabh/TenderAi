import { describe, it, expect } from 'vitest';
import {
  toRequirementCandidate,
  toRequirementCandidates,
  type RequirementSourceItem,
} from './RequirementMapper.js';

const baseItem = (
  overrides: Partial<RequirementSourceItem> = {},
): RequirementSourceItem => ({
  category: 'FINANCIAL',
  title: 'Minimum Turnover Requirement',
  description: 'Bidder must have annual turnover of ₹50 Crores',
  executionRules: {
    stampPaperRequired: true,
    stampPaperDenominationInr: 5000,
    notarizationRequired: false,
    signingAuthorityRank: 'Director',
    udinRequired: true,
  },
  provenance: {
    documentId: 'doc-001',
    documentName: 'NIT.pdf',
    pageNumber: 12,
    sectionOrClause: 'Clause 4.2.1',
    verbatimQuote: 'The bidder shall have a minimum annual turnover...',
    confidenceScore: 0.92,
  },
  ...overrides,
});

describe('RequirementMapper — ComplianceItem → AI RequirementCandidate', () => {
  it('maps all stored fields to the engine wire format (camelCase → snake_case)', () => {
    const candidate = toRequirementCandidate(baseItem());

    expect(candidate.category).toBe('FINANCIAL');
    expect(candidate.title).toBe('Minimum Turnover Requirement');
    expect(candidate.description).toBe(
      'Bidder must have annual turnover of ₹50 Crores',
    );
    expect(candidate.execution_rules).toEqual({
      stamp_paper_required: true,
      stamp_paper_denomination_inr: 5000,
      notarization_required: false,
      signing_authority_rank: 'Director',
      udin_required: true,
    });
    expect(candidate.provenance).toEqual({
      source_document_id: 'doc-001',
      source_file_name: 'NIT.pdf',
      page_number: 12,
      clause_reference: 'Clause 4.2.1',
      verbatim_quote: 'The bidder shall have a minimum annual turnover...',
      confidence_score: 0.92,
    });
  });

  it('derives kind and HARD_ELIGIBILITY criticality for eligibility-bearing categories', () => {
    const cases: Array<[string, string]> = [
      ['FINANCIAL', 'ELIGIBILITY_THRESHOLD'],
      ['STATUTORY', 'STATUTORY'],
      ['TECHNICAL', 'ELIGIBILITY_THRESHOLD'],
    ];
    for (const [category, expectedKind] of cases) {
      const candidate = toRequirementCandidate(baseItem({ category }));
      expect(candidate.kind).toBe(expectedKind);
      expect(candidate.criticality).toBe('HARD_ELIGIBILITY');
    }
  });

  it('derives SUBMISSION_MANDATORY criticality for non-eligibility categories', () => {
    for (const category of ['LEGAL', 'EXECUTION', 'UNKNOWN_CATEGORY']) {
      const candidate = toRequirementCandidate(baseItem({ category }));
      expect(candidate.criticality).toBe('SUBMISSION_MANDATORY');
    }
  });

  it('maps LEGAL → DECLARATION and EXECUTION → COMMERCIAL_TERM kinds', () => {
    expect(toRequirementCandidate(baseItem({ category: 'LEGAL' })).kind).toBe(
      'DECLARATION',
    );
    expect(
      toRequirementCandidate(baseItem({ category: 'EXECUTION' })).kind,
    ).toBe('COMMERCIAL_TERM');
  });

  it('defaults unknown categories to DECLARATION kind (never crashes)', () => {
    const candidate = toRequirementCandidate(baseItem({ category: 'WEIRD' }));
    expect(candidate.kind).toBe('DECLARATION');
    expect(candidate.criticality).toBe('SUBMISSION_MANDATORY');
  });

  it('handles null stamp denomination and missing signing rank', () => {
    const candidate = toRequirementCandidate(
      baseItem({
        executionRules: {
          stampPaperRequired: false,
          stampPaperDenominationInr: null,
          notarizationRequired: false,
          signingAuthorityRank: null,
          udinRequired: false,
        },
      }),
    );
    expect(candidate.execution_rules.stamp_paper_denomination_inr).toBeNull();
    expect(candidate.execution_rules.signing_authority_rank).toBe(
      'Authorized Signatory',
    );
  });

  it('always sends an empty ambiguity_flags list (extraction pipeline does not persist flags)', () => {
    expect(toRequirementCandidate(baseItem()).ambiguity_flags).toEqual([]);
  });

  it('maps batches in order', () => {
    const items = [
      baseItem({ title: 'First' }),
      baseItem({ title: 'Second' }),
    ];
    const candidates = toRequirementCandidates(items);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].title).toBe('First');
    expect(candidates[1].title).toBe('Second');
  });
});
