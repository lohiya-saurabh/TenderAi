/**
 * RequirementMapper — maps stored ComplianceItems to the
 * AI engine's RequirementCandidate wire format.
 *
 * The extraction pipeline persists the requirement
 * (category, title, description, execution rules,
 * grounded provenance) but not the agent-only fields
 * (kind, criticality, structured criterion). Those are
 * derived deterministically here from the stored
 * category — no inference, no LLM call:
 *
 *   kind        — category → RequirementKind
 *   criticality — eligibility-bearing categories
 *                 (FINANCIAL / STATUTORY / TECHNICAL)
 *                 map to HARD_ELIGIBILITY; everything
 *                 else is SUBMISSION_MANDATORY.
 *                 This matters: the evaluator treats
 *                 HARD_ELIGIBILITY shortfalls as
 *                 disqualifiers (NO_GO) and
 *                 SUBMISSION_MANDATORY gaps as
 *                 conditions (CONDITIONAL_GO).
 *   criterion   — null (structured thresholds are not
 *                 persisted by the extraction pipeline;
 *                 the evaluator falls back to its
 *                 documented title/description heuristics)
 */
import type { AiRequirementCandidate } from './AiDecisionClient.js';

/**
 * Structural shape of a stored compliance item.
 * `category` is TEXT in PostgreSQL; `executionRules`
 * and `provenance` are JSONB, which the ORM surfaces
 * as `unknown`. Both are narrowed defensively by the
 * helpers below — malformed stored JSON degrades to
 * safe defaults instead of throwing, and callers
 * never need to cast.
 */
export interface RequirementSourceItem {
  category: string;
  title: string;
  description: string;
  executionRules: unknown;
  provenance: unknown;
}

/** Compliance category → AI RequirementKind. */
const CATEGORY_TO_KIND: Record<string, string> = {
  FINANCIAL: 'ELIGIBILITY_THRESHOLD',
  STATUTORY: 'STATUTORY',
  TECHNICAL: 'ELIGIBILITY_THRESHOLD',
  LEGAL: 'DECLARATION',
  EXECUTION: 'COMMERCIAL_TERM',
};

/**
 * Categories whose shortfall is a hard eligibility
 * disqualifier rather than a submission condition.
 */
const HARD_ELIGIBILITY_CATEGORIES = new Set(['FINANCIAL', 'STATUTORY', 'TECHNICAL']);

interface NormalizedExecutionRules {
  stampPaperRequired: boolean;
  stampPaperDenominationInr: number | null;
  notarizationRequired: boolean;
  signingAuthorityRank: string | null;
  udinRequired: boolean;
}

const DEFAULT_EXECUTION_RULES: NormalizedExecutionRules = {
  stampPaperRequired: false,
  stampPaperDenominationInr: null,
  notarizationRequired: false,
  signingAuthorityRank: null,
  udinRequired: false,
};

/** Narrow ORM JSONB (`unknown`, possibly a JSON string) to execution rules. */
function toExecutionRules(value: unknown): NormalizedExecutionRules {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return DEFAULT_EXECUTION_RULES;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_EXECUTION_RULES;
  }
  const rules = parsed as Partial<NormalizedExecutionRules>;
  return {
    stampPaperRequired: Boolean(rules.stampPaperRequired),
    stampPaperDenominationInr:
      typeof rules.stampPaperDenominationInr === 'number' ? rules.stampPaperDenominationInr : null,
    notarizationRequired: Boolean(rules.notarizationRequired),
    signingAuthorityRank:
      typeof rules.signingAuthorityRank === 'string' ? rules.signingAuthorityRank : null,
    udinRequired: Boolean(rules.udinRequired),
  };
}

interface NormalizedProvenance {
  documentId: string;
  documentName: string;
  pageNumber: number;
  sectionOrClause: string;
  verbatimQuote: string;
  confidenceScore: number;
}

const DEFAULT_PROVENANCE: NormalizedProvenance = {
  documentId: '',
  documentName: '',
  pageNumber: 0,
  sectionOrClause: '',
  verbatimQuote: '',
  confidenceScore: 0,
};

/** Narrow ORM JSONB (`unknown`, possibly a JSON string) to provenance. */
function toProvenance(value: unknown): NormalizedProvenance {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return DEFAULT_PROVENANCE;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_PROVENANCE;
  }
  const provenance = parsed as Partial<NormalizedProvenance>;
  return {
    documentId: typeof provenance.documentId === 'string' ? provenance.documentId : '',
    documentName: typeof provenance.documentName === 'string' ? provenance.documentName : '',
    pageNumber: typeof provenance.pageNumber === 'number' ? provenance.pageNumber : 0,
    sectionOrClause:
      typeof provenance.sectionOrClause === 'string' ? provenance.sectionOrClause : '',
    verbatimQuote: typeof provenance.verbatimQuote === 'string' ? provenance.verbatimQuote : '',
    confidenceScore:
      typeof provenance.confidenceScore === 'number' ? provenance.confidenceScore : 0,
  };
}

export function toRequirementCandidate(item: RequirementSourceItem): AiRequirementCandidate {
  const category = item.category;
  const kind = CATEGORY_TO_KIND[category] ?? 'DECLARATION';
  const criticality = HARD_ELIGIBILITY_CATEGORIES.has(category)
    ? 'HARD_ELIGIBILITY'
    : 'SUBMISSION_MANDATORY';

  const executionRules = toExecutionRules(item.executionRules);
  const provenance = toProvenance(item.provenance);

  return {
    category,
    kind,
    criticality,
    title: item.title,
    description: item.description,
    criterion: null,
    execution_rules: {
      stamp_paper_required: executionRules.stampPaperRequired,
      stamp_paper_denomination_inr: executionRules.stampPaperDenominationInr,
      notarization_required: executionRules.notarizationRequired,
      signing_authority_rank: executionRules.signingAuthorityRank ?? 'Authorized Signatory',
      udin_required: executionRules.udinRequired,
    },
    provenance: {
      source_document_id: provenance.documentId,
      source_file_name: provenance.documentName,
      page_number: provenance.pageNumber,
      clause_reference: provenance.sectionOrClause,
      verbatim_quote: provenance.verbatimQuote,
      confidence_score: provenance.confidenceScore,
    },
    ambiguity_flags: [],
  };
}

export function toRequirementCandidates(items: RequirementSourceItem[]): AiRequirementCandidate[] {
  return items.map(toRequirementCandidate);
}
