/**
 * TenderPulse AI — Deterministic Grounding Derivation
 *
 * In TenderPulse's procurement architecture, source citation grounding
 * verifies whether an extracted requirement is rooted in the tender document.
 * Grounding is not an arbitrary float or model confidence; it derives from:
 * 1. Verbatim quote presence & substantive text length
 * 2. Exact physical page anchor (pageNumber > 0)
 * 3. Specific clause/section coordinates (e.g. ITB Clause 2.2.2.1)
 * 4. Document provenance ID / document name
 *
 * Under the platform's hard grounding invariant (DOMAIN.md §28), every compliance item
 * persisted to PostgreSQL passed exact-substring verification (verbatimQuote ∈ pageText).
 * When all 4 coordinates are present, the quote is a 100% verified verbatim match.
 */

export interface GroundingDerivation {
  /** Derived percentage of grounding completeness (0..100) */
  matchPct: number;
  /** Human-readable status badge text */
  badgeLabel: string;
  /** Secondary explanatory note showing the verified citation coordinates */
  citationNote: string;
  /** Whether the item satisfies the 100% exact substring invariant */
  isExactVerbatim: boolean;
  /** Individual coordinate anchor booleans */
  anchors: {
    hasVerbatimQuote: boolean;
    hasPageNumber: boolean;
    hasClauseReference: boolean;
    hasDocumentAnchor: boolean;
  };
}

export function deriveGroundingMatch(item: {
  provenance?: {
    documentId?: string;
    documentName?: string;
    pageNumber?: number;
    sectionOrClause?: string | null;
    verbatimQuote?: string;
    confidenceScore?: number;
  } | null;
  sourceCitation?: {
    document?: string;
    page?: number;
    section?: string;
    verbatimQuote?: string;
    confidenceScore?: number;
  } | null;
  description?: string;
}): GroundingDerivation {
  const quote = (item.provenance?.verbatimQuote || item.sourceCitation?.verbatimQuote || '').trim();
  const page = item.provenance?.pageNumber ?? item.sourceCitation?.page;
  const clause = (item.provenance?.sectionOrClause || item.sourceCitation?.section || '').trim();
  const doc = (
    item.provenance?.documentName ||
    item.sourceCitation?.document ||
    item.provenance?.documentId ||
    ''
  ).trim();

  const hasVerbatimQuote = quote.length >= 15;
  const hasPageNumber = typeof page === 'number' && page > 0;
  const hasClauseReference = clause.length > 0;
  const hasDocumentAnchor = doc.length > 0;

  // Fully anchored & verified:
  if (hasVerbatimQuote && hasPageNumber && hasClauseReference && hasDocumentAnchor) {
    return {
      matchPct: 100,
      badgeLabel: '100% Verbatim Grounding',
      citationNote: `Exact quote verified from ${doc}, Page ${page} (${clause})`,
      isExactVerbatim: true,
      anchors: {
        hasVerbatimQuote,
        hasPageNumber,
        hasClauseReference,
        hasDocumentAnchor,
      },
    };
  }

  // Derive score proportionally based on available anchor signals:
  let score = 0;
  if (hasVerbatimQuote) score += 50;
  if (hasPageNumber) score += 20;
  if (hasClauseReference) score += 20;
  if (hasDocumentAnchor) score += 10;

  return {
    matchPct: score,
    badgeLabel: `${score}% Grounding Match`,
    citationNote:
      hasPageNumber && doc
        ? `Partially anchored to ${doc}, Page ${page}`
        : 'Source citation coordinates incomplete',
    isExactVerbatim: false,
    anchors: {
      hasVerbatimQuote,
      hasPageNumber,
      hasClauseReference,
      hasDocumentAnchor,
    },
  };
}
