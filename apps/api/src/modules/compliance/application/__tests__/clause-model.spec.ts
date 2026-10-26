import { describe, expect, it } from 'vitest';
import {
  checkQuote,
  computeAiBand,
  isPageTextChunk,
  legacyStatusFor,
  locationKey,
  mapLegacyStatus,
  requiresSourceForConfirm,
  stripChunkHeading,
  toAttestation,
} from '../clause-model.js';

describe('clause model', () => {
  it('computes the same location key as the AI service (apps/ai location_key)', () => {
    // Value produced by tenderpulse_ai.domain.requirement_attributes.location_key
    expect(locationKey('doc_fixture_nit', 3, '  The Earnest Money shall be\nRs. 12,500.')).toBe(
      'cl_81af746281c904a4f45ef9b8',
    );
  });

  it('verifies quotes against page text without claiming anything when text is missing', () => {
    const page =
      'Clause 4\n4.1 The bidder shall furnish a Performance Security of 5% of the contract value.';
    expect(checkQuote('The bidder shall furnish a Performance Security of 5%', [page])).toBe(
      'EXACT',
    );
    expect(checkQuote('the BIDDER shall  furnish a performance security', [page])).toBe(
      'NORMALISED',
    );
    expect(checkQuote('The bidder shall furnish 10%', [page])).toBe('NOT_FOUND');
    expect(checkQuote('anything', [])).toBe('NO_PAGE_TEXT');
    expect(checkQuote('anything', ['  '])).toBe('NO_PAGE_TEXT');
  });

  it('puts a clause in the spot-check band only when every signal is clean', () => {
    const clean = {
      quoteCheck: 'EXACT' as const,
      confidence: 1,
      flags: [],
      disqualifying: null,
    };
    expect(computeAiBand(clean)).toBe('SPOT_CHECK');
    expect(computeAiBand({ ...clean, confidence: 0.85 })).toBe('CHECK_CAREFULLY');
    expect(computeAiBand({ ...clean, confidence: null })).toBe('CHECK_CAREFULLY');
    expect(computeAiBand({ ...clean, disqualifying: true })).toBe('CHECK_CAREFULLY');
    expect(computeAiBand({ ...clean, quoteCheck: 'NO_PAGE_TEXT' })).toBe('CHECK_CAREFULLY');
    expect(computeAiBand({ ...clean, quoteCheck: 'NOT_FOUND' })).toBe('REVIEW_REQUIRED');
    expect(computeAiBand({ ...clean, flags: ['CONFLICT'] })).toBe('REVIEW_REQUIRED');
    expect(computeAiBand({ ...clean, flags: ['NEAR_FAILED_PAGE'] })).toBe('REVIEW_REQUIRED');
  });

  it('requires the source to be opened before confirming anything but a clean spot-check', () => {
    expect(
      requiresSourceForConfirm({
        aiBand: 'SPOT_CHECK',
        disqualifying: null,
        flags: [],
      }),
    ).toBe(false);
    expect(
      requiresSourceForConfirm({
        aiBand: 'CHECK_CAREFULLY',
        disqualifying: null,
        flags: [],
      }),
    ).toBe(true);
    expect(
      requiresSourceForConfirm({
        aiBand: 'SPOT_CHECK',
        disqualifying: true,
        flags: [],
      }),
    ).toBe(true);
  });

  it('maps legacy statuses: system-assigned statuses never become a review decision', () => {
    for (const s of ['READY', 'FLAGGED', 'PENDING', 'PASS', 'WAIVED']) {
      expect(mapLegacyStatus(s, false).review).toBe('UNREVIEWED');
    }
    expect(mapLegacyStatus('REVIEW_REQUIRED', false).review).toBe('NEEDS_REVIEW');
    expect(mapLegacyStatus('PASS', true)).toEqual({
      review: 'CONFIRMED',
      fulfilment: 'DONE',
    });
    expect(mapLegacyStatus('FAIL', true)).toEqual({
      review: 'CONFIRMED',
      fulfilment: 'AT_RISK',
    });
    expect(mapLegacyStatus('WAIVED', true)).toEqual({
      review: 'CONFIRMED',
      fulfilment: 'NOT_APPLICABLE',
    });
    expect(mapLegacyStatus('REJECTED', true).review).toBe('NOT_A_REQUIREMENT');
    expect(legacyStatusFor('NOT_A_REQUIREMENT', 'PENDING')).toBe('NOT_APPLICABLE');
    expect(legacyStatusFor('CONFIRMED', 'PENDING')).toBe('PENDING');
  });

  it('keeps attestation tri-state (null = not stated)', () => {
    expect(
      toAttestation({
        stampPaperRequired: true,
        stampPaperDenominationInr: 0,
        signingAuthorityRank: ' ',
      }),
    ).toEqual({
      stampPaper: true,
      stampDenominationInr: null,
      notarised: null,
      udin: null,
      apostille: null,
      clientCountersign: null,
      signatoryRank: null,
    });
    expect(toAttestation({ notarizationRequired: false }).notarised).toBe(false);
  });

  it('reads only a page’s own text from chunks', () => {
    expect(isPageTextChunk('CLAUSE')).toBe(true);
    expect(isPageTextChunk('SKELETON')).toBe(false);
    expect(isPageTextChunk('CLAUSE_CHILD')).toBe(false);
    expect(stripChunkHeading('[Clause 2 EMD]\n2.1 The bidder shall pay.')).toBe(
      '2.1 The bidder shall pay.',
    );
  });
});
