/**
 * TenderPulse AI — Tender Detail Derivations
 *
 * Pure functions over the existing API contract:
 *   - BidDetail        from GET /api/v1/bids/:id
 *   - ComplianceItem[] from GET /api/v1/bids/:id/compliance-items
 *   - BidDecisionSummary from GET /api/v1/bids/:id/bid-decision
 *
 * The bid/no-bid recommendation (PURSUE / DO_NOT_PURSUE /
 * REVIEW_REQUIRED) is produced by the deterministic eligibility
 * engine evaluating the Company Capability Profile against this
 * tender. The backend now exposes GET /api/v1/bids/:id/bid-decision
 * returning a BidDecisionSummary with verdict GO/CONDITIONAL_GO/
 * NO_GO/REVIEW_REQUIRED. This module maps those to the frontend
 * PURSUE/DO_NOT_PURSUE/REVIEW_REQUIRED framework.
 */

import type { BidDetail } from '@/api/bids.js';
import type { ComplianceItem } from '@/api/compliance.js';
import type { BidDecisionSummary, BidVerdict, BidDecisionState } from '@/api/bids.js';
import { computeReadiness, type ReadinessSummary } from '@/utils/readiness.js';

// ---------------------------------------------------------------------------
// Bid decision types (mapped from API)
// ---------------------------------------------------------------------------

export type BidRecommendation =
  'PURSUE' | 'DO_NOT_PURSUE' | 'REVIEW_REQUIRED' | 'RECOMMENDATION_UNAVAILABLE';

/**
 * Frontend-friendly decision view mapped from the API response.
 * The API returns:
 *   - verdict: GO | CONDITIONAL_GO | NO_GO | REVIEW_REQUIRED
 *   - state: AI_PROPOSED | UNDER_REVIEW | CONFIRMED | OVERRIDDEN
 *   - readinessScore: 0.0–1.0
 *   - reasonsToPursue, reasonsNotToPursue, hardDisqualifiers,
 *     missingInformation, uncertainAreas, commercialRisks,
 *     evidenceCitations, reviewTriggers
 */
export interface BidDecision {
  bidId: string;
  decisionId?: string;
  profileVersionId?: string;
  verdict: BidRecommendation;
  state?: BidDecisionState;
  readinessScore?: number;
  /** Human-readable, evidence-backed reasons for the verdict */
  reasons: string[];
  reasonsToPursue?: unknown[];
  reasonsNotToPursue?: unknown[];
  hardDisqualifiers?: unknown[];
  missingInformation?: unknown[];
  uncertainAreas?: unknown[];
  commercialRisks?: unknown[];
  evidenceCitations?: unknown[];
  reviewTriggers?: unknown[];
  evaluatedAt: string;
  evaluatedFactors: number;
}

/**
 * Map the engine's verdict (GO/CONDITIONAL_GO/NO_GO/REVIEW_REQUIRED)
 * to the frontend recommendation framework.
 *
 * - GO / CONDITIONAL_GO → PURSUE (CONDITIONAL_GO shows conditions)
 * - NO_GO → DO_NOT_PURSUE
 * - REVIEW_REQUIRED → REVIEW_REQUIRED
 */
export function mapVerdict(
  verdict?: BidVerdict | string | null,
  hasMissingEvidence?: boolean,
): BidRecommendation {
  if (!verdict) return 'RECOMMENDATION_UNAVAILABLE';
  switch (verdict.toUpperCase().trim()) {
    case 'GO':
    case 'CONDITIONAL_GO':
    case 'PROCEED_WITH_CAUTION':
    case 'PURSUE':
      return 'PURSUE';
    case 'NO_GO':
    case 'DO_NOT_PURSUE':
    case 'REJECT':
      return 'DO_NOT_PURSUE';
    case 'INSUFFICIENT_DATA':
    case 'RECOMMENDATION_UNAVAILABLE':
    case 'UNAVAILABLE':
      return 'RECOMMENDATION_UNAVAILABLE';
    case 'REVIEW_REQUIRED':
    case 'UNDER_REVIEW':
    default:
      if (hasMissingEvidence) {
        return 'RECOMMENDATION_UNAVAILABLE';
      }
      return 'REVIEW_REQUIRED';
  }
}

/**
 * Defensively cleans and unwraps nested, markdown-fenced, or stringified JSON strings.
 */
export function cleanStringAndUnwrapJson(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return val;

  let str = val.trim();
  if (!str) return '';

  for (let iter = 0; iter < 5; iter++) {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = str.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) {
      str = (fenceMatch[1] ?? '').trim();
    } else if (str.startsWith('```') && str.endsWith('```')) {
      str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    } else if (str.startsWith('```')) {
      str = str.replace(/^```(?:json)?\s*/i, '').trim();
    }
    if (!str) return '';

    // Strip outer quotes if stringified JSON string
    if (
      (str.startsWith('"') && str.endsWith('"') && str.length >= 2) ||
      (str.startsWith("'") && str.endsWith("'") && str.length >= 2)
    ) {
      try {
        const unquoted = JSON.parse(str);
        if (typeof unquoted === 'string') {
          str = unquoted.trim();
          continue;
        }
        if (typeof unquoted === 'object' && unquoted !== null) {
          return unquoted;
        }
      } catch {
        str = str.slice(1, -1).trim();
      }
    }

    // Try repairing unclosed / truncated JSON object (e.g. trailing comma or missing closing brace)
    if (str.startsWith('{') && !str.endsWith('}')) {
      try {
        const withoutTrailingCommas = str.replace(/,\s*$/, '').trim() + '}';
        const parsed = JSON.parse(withoutTrailingCommas.replace(/,\s*([}\]])/g, '$1'));
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      } catch {
        // Continue
      }
    }

    // Try parsing as JSON object or array
    if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
      try {
        return JSON.parse(str);
      } catch {
        try {
          const withoutTrailingCommas = str.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(withoutTrailingCommas);
        } catch {
          // Continue
        }
      }
    }

    // Check for string with colon prefix and embedded JSON object: e.g. "Notice: { ... }"
    const colonJsonMatch = str.match(/^([^:{}\n]+)\s*:\s*(\{[\s\S]*\}|\[[\s\S]*\])$/);
    if (colonJsonMatch && colonJsonMatch[2]) {
      try {
        const cleanedJson = colonJsonMatch[2].replace(/,\s*([}\]])/g, '$1');
        const parsed = JSON.parse(cleanedJson);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      } catch {
        // Continue
      }
    }

    // Robust, general XML/HTML markup extraction
    if (str.startsWith('<') && str.endsWith('>')) {
      const stripInnerTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const tagMap: Record<string, string> = {};
      const tagRegex = /<([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(str)) !== null) {
        const tagName = match[1]?.toLowerCase();
        const innerContent = match[2] ?? '';
        if (!tagName) continue;
        if (/<[a-zA-Z0-9_-]+/i.test(innerContent)) {
          const innerRegex = /<([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
          let innerMatch: RegExpExecArray | null;
          while ((innerMatch = innerRegex.exec(innerContent)) !== null) {
            const innerTagName = innerMatch[1]?.toLowerCase();
            const innerText = innerMatch[2] ?? '';
            if (innerTagName) {
              tagMap[innerTagName] = stripInnerTags(innerText);
            }
          }
        } else {
          tagMap[tagName] = stripInnerTags(innerContent);
        }
      }
      const extractedTitle =
        tagMap.title || tagMap.requirement_title || tagMap.requirementtitle || tagMap.name;
      const extractedReason =
        tagMap.reason || tagMap.detail || tagMap.description || tagMap.summary || tagMap.message;
      if (extractedTitle || extractedReason) {
        return {
          title: extractedTitle || 'Disqualification Risk',
          reason: extractedReason || 'Disqualification criteria not met.',
          shortfallDetail: tagMap.shortfall || tagMap.shortfall_detail || undefined,
          clauseReference: tagMap.clause || tagMap.clause_reference || undefined,
        };
      }
      const cleanContent = stripInnerTags(str);
      if (cleanContent) {
        return cleanContent;
      }
    }

    break;
  }

  return str;
}

/**
 * Safely extracts human-readable text from any value (string, object, array).
 * Guarantees zero raw JSON stringification (no `{"` or `":`) and zero `[object Object]`.
 */
export function extractCleanText(val: unknown): string {
  if (val === null || val === undefined) return '';

  const unwrapped = cleanStringAndUnwrapJson(val);
  if (unwrapped === null || unwrapped === undefined) return '';

  if (typeof unwrapped === 'string') {
    let trimmed = unwrapped.trim();
    if (!trimmed) return '';

    // If still looks like an unparsed JSON object or code fence, clean it
    if (trimmed.startsWith('```') || trimmed.endsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      if (!trimmed) return '';
    }
    // Remove raw JSON artifacts like {"title": "..."} or broken JSON
    if (trimmed.startsWith('{') || trimmed.includes('":')) {
      if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
        try {
          const repaired = trimmed.replace(/,\s*$/, '').trim() + '}';
          const parsed = JSON.parse(repaired.replace(/,\s*([}\]])/g, '$1'));
          if (typeof parsed === 'object' && parsed !== null) {
            return extractCleanText(parsed);
          }
        } catch {
          // Continue
        }
      }
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed.replace(/,\s*([}\]])/g, '$1'));
          if (typeof parsed === 'object' && parsed !== null) {
            return extractCleanText(parsed);
          }
        } catch {
          trimmed = trimmed.replace(/^\{\s*|\s*\}$/g, '');
        }
      }
      trimmed = trimmed.replace(/^[{\s"']+|[}\s"',]+$/g, '').trim();
    }
    return trimmed;
  }

  if (typeof unwrapped === 'number' || typeof unwrapped === 'boolean') {
    return String(unwrapped);
  }

  if (typeof unwrapped === 'object') {
    if (Array.isArray(unwrapped)) {
      return unwrapped.map(extractCleanText).filter(Boolean).join(', ');
    }
    const rec = unwrapped as Record<string, unknown>;
    // Check known direct text fields
    const direct =
      rec.detail ??
      rec.reason ??
      rec.summary ??
      rec.description ??
      rec.message ??
      rec.value ??
      rec.explanation ??
      rec.text ??
      rec.title;
    if (direct !== undefined && direct !== null) {
      if (typeof direct === 'string') return direct.trim();
      if (typeof direct === 'object') return extractCleanText(direct);
    }

    // Check structured shortfall pairs (required vs found/actual)
    if (rec.required || rec.found || rec.actual) {
      const parts: string[] = [];
      if (rec.required) parts.push(`Required: ${extractCleanText(rec.required)}`);
      if (rec.found) parts.push(`Found: ${extractCleanText(rec.found)}`);
      else if (rec.actual) parts.push(`Found: ${extractCleanText(rec.actual)}`);
      return parts.join(' | ');
    }

    // Format remaining entries cleanly without raw JSON punctuation
    const cleanPairs = Object.entries(rec)
      .filter(([k, v]) => v !== null && v !== undefined && !k.startsWith('_'))
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${extractCleanText(v)}`)
      .filter(Boolean);
    return cleanPairs.join('; ');
  }
  return '';
}

export function formatReasonItem(r: unknown): string | null {
  if (!r) return null;
  const unwrapped = cleanStringAndUnwrapJson(r);
  if (unwrapped === null || unwrapped === undefined) return null;

  if (typeof unwrapped === 'string') {
    const trimmed = unwrapped.trim();
    if (!trimmed) return null;
    return extractCleanText(trimmed);
  }
  if (typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    const title = extractCleanText(obj.title || obj.category || obj.name || '');
    const detail = extractCleanText(obj.detail || obj.reason || obj.summary || obj.description || '');
    if (title && detail) return `${title}: ${detail}`;
    if (detail) return detail;
    if (title) return title;
    return extractCleanText(obj) || null;
  }
  return String(unwrapped);
}

export interface NormalizedDisqualifier {
  title: string;
  reason: string;
  shortfallDetail?: string;
  clauseReference?: string;
  factor?: string;
}

/**
 * Defensively parses any disqualifier item (structured object, camelCase/snake_case,
 * stringified JSON string, or plain string) into a clean, normalized structure.
 * Guaranteed never to return raw JSON or [object Object].
 */
export function parseDisqualifierItem(d: unknown): NormalizedDisqualifier | null {
  if (d === null || d === undefined) return null;

  if (Array.isArray(d)) {
    const flat = d.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== '');
    if (flat.length === 0) return null;
    if (flat.length === 1) return parseDisqualifierItem(flat[0]);
    const parsedItems = flat.map(parseDisqualifierItem).filter((p): p is NormalizedDisqualifier => p !== null);
    if (parsedItems.length === 0) return null;
    if (parsedItems.length === 1) return parsedItems[0] ?? null;
    return {
      title: 'Multiple Disqualifications',
      reason: parsedItems.map((item) => `${item.title}: ${item.reason}`).join('; '),
    };
  }

  const unwrapped = cleanStringAndUnwrapJson(d);
  if (unwrapped === null || unwrapped === undefined) return null;

  let obj: Record<string, unknown> | null = null;

  if (typeof unwrapped === 'string') {
    let trimmed = unwrapped.trim();
    if (!trimmed) return null;

    // Strip residual markdown backtick code fences
    if (trimmed.startsWith('```') || trimmed.endsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      if (!trimmed) return null;
    }

    // Defensive handling for broken or unclosed JSON strings
    if (trimmed.startsWith('{')) {
      try {
        const candidate = trimmed.endsWith('}') ? trimmed : trimmed.replace(/,\s*$/, '').trim() + '}';
        const parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parseDisqualifierItem(parsed);
        }
      } catch {
        const titleMatch = trimmed.match(/["']?(?:requirement_title|requirementTitle|title|requirement|name)["']?\s*:\s*["']([^"'\n]+)["']?/i);
        const reasonMatch = trimmed.match(/["']?(?:reason|detail|description|shortfall_detail|shortfallDetail|summary)["']?\s*:\s*["']([^"'\n]+)["']?/i);
        const shortfallMatch = trimmed.match(/["']?(?:shortfall_detail|shortfallDetail|shortfall|deficit)["']?\s*:\s*["']([^"'\n]+)["']?/i);
        const clauseMatch = trimmed.match(/["']?(?:clause_reference|clauseReference|clauseRef|clause)["']?\s*:\s*["']([^"'\n]+)["']?/i);

        if (titleMatch || reasonMatch) {
          const cleanTitle = titleMatch?.[1] ? extractCleanText(titleMatch[1]).replace(/^[{"'\s]+|[}"':\s]+$/g, '').trim() : undefined;
          const cleanReason = reasonMatch?.[1] ? extractCleanText(reasonMatch[1]).replace(/^[{"'\s]+|[}"'\s,:]+$/g, '').trim() : undefined;
          const cleanShortfall = shortfallMatch?.[1] ? extractCleanText(shortfallMatch[1]).replace(/^[{"'\s]+|[}"'\s,:]+$/g, '').trim() : undefined;
          const cleanClause = clauseMatch?.[1] ? extractCleanText(clauseMatch[1]).replace(/^[{"'\s]+|[}"'\s,:]+$/g, '').trim() : undefined;

          return {
            title: cleanTitle || 'Disqualification Risk',
            reason: cleanReason || 'Disqualification criteria not met.',
            shortfallDetail: cleanShortfall || undefined,
            clauseReference: cleanClause || undefined,
          };
        }
        trimmed = trimmed.replace(/^[{\s"']+|[}\s"',]+$/g, '').trim();
      }
    }

    // Check if string is formatted like "Title: Reason (Shortfall)"
    let titlePart = 'Disqualification Risk';
    let rest = trimmed;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0 && colonIndex < 60) {
      const candidateTitle = trimmed.slice(0, colonIndex).trim();
      const isJsonKey = /^[{\s"']*(?:title|requirement_title|requirementTitle|requirement|reason|detail|description|summary|verdict|category|factor|name)[}"'\s]*$/i.test(candidateTitle);
      const hasJsonBrace = candidateTitle.includes('{') || candidateTitle.includes('}');
      if (!isJsonKey && !hasJsonBrace) {
        titlePart = candidateTitle;
        rest = trimmed.slice(colonIndex + 1).trim();
      }
    }

    let shortfallDetail: string | undefined;
    const shortfallMatch = rest.match(/\((?:shortfall\s*:?\s*)?([^)]+)\)$/i);
    if (shortfallMatch && shortfallMatch[1]) {
      shortfallDetail = shortfallMatch[1].trim();
      rest = rest.replace(/\((?:shortfall\s*:?\s*)?[^)]+\)$/i, '').trim();
    }

    const cleanTitle = extractCleanText(titlePart).replace(/^[{"'\s]+|[}"':\s]+$/g, '').trim();
    const cleanReason = extractCleanText(rest).replace(/^[{"'\s]+|[}"'\s,:]+$/g, '').trim();

    return {
      title: cleanTitle || 'Disqualification Risk',
      reason: cleanReason || extractCleanText(trimmed) || 'Disqualification criteria not met.',
      shortfallDetail: shortfallDetail ? extractCleanText(shortfallDetail) : undefined,
    };
  } else if (typeof unwrapped === 'object') {
    if (Array.isArray(unwrapped)) {
      const flat = unwrapped.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== '');
      if (flat.length === 0) return null;
      if (flat.length === 1) return parseDisqualifierItem(flat[0]);
      const parsedItems = flat.map(parseDisqualifierItem).filter((p): p is NormalizedDisqualifier => p !== null);
      if (parsedItems.length === 0) return null;
      if (parsedItems.length === 1) return parsedItems[0] ?? null;
      return {
        title: 'Multiple Disqualifications',
        reason: parsedItems.map((item) => `${item.title}: ${item.reason}`).join('; '),
      };
    }
    obj = unwrapped as Record<string, unknown>;
  } else {
    return {
      title: 'Disqualification Risk',
      reason: String(unwrapped),
    };
  }

  if (!obj) return null;

  const rawTitle =
    obj.requirement_title ??
    obj.requirementTitle ??
    obj.title ??
    (typeof obj.requirement === 'object' && obj.requirement !== null
      ? (obj.requirement as Record<string, unknown>).title || (obj.requirement as Record<string, unknown>).name
      : obj.requirement) ??
    obj.name ??
    obj.factor ??
    obj.category ??
    'Mandatory Disqualification';

  const rawReason =
    obj.reason ??
    obj.detail ??
    obj.description ??
    obj.shortfall_detail ??
    obj.shortfallDetail ??
    obj.summary ??
    (typeof obj.reason === 'object' && obj.reason !== null
      ? (obj.reason as Record<string, unknown>).explanation || (obj.reason as Record<string, unknown>).detail || (obj.reason as Record<string, unknown>).text
      : undefined) ??
    'Requirement criteria not satisfied.';

  const rawShortfall =
    obj.shortfall_detail ??
    obj.shortfallDetail ??
    obj.shortfall ??
    obj.deficit;

  const rawClause =
    obj.clause_reference ??
    obj.clauseReference ??
    obj.clauseRef ??
    (typeof obj.clause === 'object' && obj.clause !== null
      ? (obj.clause as Record<string, unknown>).reference || (obj.clause as Record<string, unknown>).clauseReference
      : undefined) ??
    obj.clause ??
    obj.tenderClauseRef ??
    obj.tender_clause_reference ??
    obj.reference;

  const rawFactor =
    obj.factor ??
    obj.category ??
    obj.subCategory;

  const title = extractCleanText(rawTitle) || 'Mandatory Disqualification';
  const reason = extractCleanText(rawReason) || 'Requirement criteria not satisfied.';
  const shortfallDetail = rawShortfall ? extractCleanText(rawShortfall) : undefined;
  const clauseReference = rawClause ? extractCleanText(rawClause) : undefined;
  const factor = rawFactor ? extractCleanText(rawFactor) : undefined;

  return {
    title,
    reason,
    shortfallDetail: shortfallDetail || undefined,
    clauseReference: clauseReference || undefined,
    factor: factor || undefined,
  };
}

export function formatDisqualifierItem(d: unknown): string | null {
  const item = parseDisqualifierItem(d);
  if (!item) return null;
  let text = `${item.title}: ${item.reason}`;
  if (item.shortfallDetail && item.shortfallDetail !== item.reason) {
    text += ` (${item.shortfallDetail})`;
  }
  return text;
}

export function formatMissingItem(g: unknown): string | null {
  if (!g) return null;
  const unwrapped = cleanStringAndUnwrapJson(g);
  if (unwrapped === null || unwrapped === undefined) return null;

  if (typeof unwrapped === 'string') {
    const trimmed = unwrapped.trim();
    if (!trimmed) return null;
    return extractCleanText(trimmed);
  }
  if (typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    const title = extractCleanText(obj.title || obj.requirement_title || obj.requirementTitle || '');
    const missing = extractCleanText(
      obj.missingFactor || obj.missing_factor || obj.detail || obj.reason || '',
    );
    const action = extractCleanText(obj.suggestedAction || obj.suggested_action || obj.mitigation || '');
    if (title && missing) {
      return `${title}: ${missing}${action ? ` — ${action}` : ''}`;
    }
    if (missing) return action ? `${missing} — ${action}` : missing;
    if (title) return title;
    return extractCleanText(obj) || null;
  }
  return String(unwrapped);
}

export function formatUncertainItem(u: unknown): string | null {
  if (!u) return null;
  const unwrapped = cleanStringAndUnwrapJson(u);
  if (unwrapped === null || unwrapped === undefined) return null;

  if (typeof unwrapped === 'string') {
    const trimmed = unwrapped.trim();
    if (!trimmed) return null;
    return extractCleanText(trimmed);
  }
  if (typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    const title = extractCleanText(
      obj.title || obj.clauseReference || obj.clause_reference || obj.ambiguityType || '',
    );
    const detail = extractCleanText(
      obj.detail ||
        obj.quote ||
        obj.recommendedClarification ||
        obj.recommended_clarification ||
        obj.summary ||
        '',
    );
    if (title && detail) return `${title}: ${detail}`;
    if (detail) return detail;
    if (title) return title;
    return extractCleanText(obj) || null;
  }
  return String(unwrapped);
}

export function formatCommercialRiskItem(r: unknown): string | null {
  if (!r) return null;
  const unwrapped = cleanStringAndUnwrapJson(r);
  if (unwrapped === null || unwrapped === undefined) return null;

  if (typeof unwrapped === 'string') {
    const trimmed = unwrapped.trim();
    if (!trimmed) return null;
    return extractCleanText(trimmed);
  }
  if (typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    const title = extractCleanText(
      obj.title ||
        (obj.category ? String(obj.category).replace(/_/g, ' ') : '') ||
        (obj.level ? `${obj.level} Risk` : obj.severity ? `${obj.severity} Risk` : '') ||
        '',
    );
    const detail = extractCleanText(obj.detail || obj.summary || obj.description || '');
    const advice = extractCleanText(obj.mitigationAdvice || obj.mitigation_advice || obj.mitigation || '');
    if (title && detail && advice) return `${title}: ${detail} [${advice}]`;
    if (title && detail) return `${title}: ${detail}`;
    if (detail && advice) return `${detail} [${advice}]`;
    if (detail) return detail;
    if (title) return title;
    return extractCleanText(obj) || null;
  }
  return String(unwrapped);
}

/**
 * Extract human-readable reasons from the decision response.
 * Combines reasonsToPursue, reasonsNotToPursue, hardDisqualifiers,
 * missingInformation, and uncertainAreas into a flat string array.
 */
export function extractReasons(decision: BidDecisionSummary): string[] {
  const reasons: string[] = [];

  (decision.reasonsToPursue ?? []).forEach((r) => {
    const formatted = formatReasonItem(r);
    if (formatted) reasons.push(formatted);
  });

  (decision.hardDisqualifiers ?? []).forEach((d) => {
    const formatted = formatDisqualifierItem(d);
    if (formatted) reasons.push(`${formatted} (hard disqualifier)`);
  });

  (decision.reasonsNotToPursue ?? []).forEach((r) => {
    const formatted = formatReasonItem(r);
    if (formatted) reasons.push(formatted);
  });

  (decision.missingInformation ?? []).forEach((g) => {
    const formatted = formatMissingItem(g);
    if (formatted) reasons.push(`${formatted} (missing information)`);
  });

  (decision.uncertainAreas ?? []).forEach((u) => {
    const formatted = formatUncertainItem(u);
    if (formatted) reasons.push(`${formatted} (uncertain)`);
  });

  (decision.commercialRisks ?? []).forEach((r) => {
    const formatted = formatCommercialRiskItem(r);
    if (formatted) reasons.push(`${formatted} (commercial risk)`);
  });

  return reasons;
}

/**
 * Convert the API BidDecisionSummary to the frontend BidDecision view.
 */
export function toBidDecision(apiDecision: BidDecisionSummary): BidDecision {
  return {
    bidId: apiDecision.bidId,
    decisionId: apiDecision.decisionId,
    profileVersionId: apiDecision.profileVersionId,
    verdict: mapVerdict(apiDecision.verdict),
    state: apiDecision.state,
    readinessScore: apiDecision.readinessScore,
    reasons: extractReasons(apiDecision),
    reasonsToPursue: apiDecision.reasonsToPursue,
    reasonsNotToPursue: apiDecision.reasonsNotToPursue,
    hardDisqualifiers: apiDecision.hardDisqualifiers,
    missingInformation: apiDecision.missingInformation,
    uncertainAreas: apiDecision.uncertainAreas,
    commercialRisks: apiDecision.commercialRisks,
    evidenceCitations: apiDecision.evidenceCitations,
    reviewTriggers: apiDecision.reviewTriggers,
    evaluatedAt: apiDecision.evaluatedAt,
    evaluatedFactors:
      (apiDecision.reasonsToPursue?.length ?? 0) +
      (apiDecision.reasonsNotToPursue?.length ?? 0) +
      (apiDecision.hardDisqualifiers?.length ?? 0) +
      (apiDecision.missingInformation?.length ?? 0) +
      (apiDecision.uncertainAreas?.length ?? 0) +
      (apiDecision.commercialRisks?.length ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Compliance rollup
// ---------------------------------------------------------------------------

export interface ComplianceRollup {
  total: number;
  pending: number;
  ready: number;
  flagged: number;
  waived: number;
  /** Items explicitly marked humanReviewRequired */
  reviewRequired: number;
  /** Items awaiting any human action: PENDING or humanReviewRequired */
  reviewNeeded: number;
  readiness: ReadinessSummary;
}

/** Roll up the requirement matrix into the counts the detail page shows. */
export function getComplianceRollup(
  items: ComplianceItem[],
  bid: Pick<BidDetail, 'totalRequirements' | 'approvedRequirements' | 'flaggedRequirements'>,
): ComplianceRollup {
  const getStatus = (item: ComplianceItem): string => item.status;

  return {
    total: items.length,
    // New statuses: PASS, FAIL, MISSING, REVIEW_REQUIRED, NOT_APPLICABLE
    // Old statuses: PENDING, READY, FLAGGED, WAIVED
    pending: items.filter((i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING').length,
    ready: items.filter((i) => getStatus(i) === 'READY' || getStatus(i) === 'PASS').length,
    flagged: items.filter((i) => getStatus(i) === 'FLAGGED' || getStatus(i) === 'FAIL').length,
    waived: items.filter((i) => getStatus(i) === 'WAIVED' || getStatus(i) === 'NOT_APPLICABLE')
      .length,
    reviewRequired: items.filter((i) => i.humanReviewRequired).length,
    reviewNeeded: items.filter(
      (i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING' || i.humanReviewRequired,
    ).length,
    readiness: computeReadiness(bid),
  };
}

// ---------------------------------------------------------------------------
// Statutory obligations (aggregated from real execution rules)
// ---------------------------------------------------------------------------

export interface ObligationsSummary {
  /** Requirements mandating non-judicial stamp paper */
  stampPaperCount: number;
  /** Highest mandated stamp paper denomination (INR), or null */
  maxStampDenominationInr: number | null;
  /** Requirements mandating notarization / attestation */
  notarizationCount: number;
  /** Requirements mandating a CA certificate with UDIN */
  udinCount: number;
  /** Distinct signing authority ranks mandated (e.g. "Director", "Partner") */
  signingAuthorityRanks: string[];
}

/** Aggregate execution rules across the requirement matrix. */
export function getObligationsSummary(items: ComplianceItem[]): ObligationsSummary {
  let maxStampDenominationInr: number | null = null;
  const signingAuthorityRanks = new Set<string>();

  let stampPaperCount = 0;
  let notarizationCount = 0;
  let udinCount = 0;

  for (const item of items) {
    const rules = item.executionRules;
    if (!rules) continue;

    if (rules.stampPaperRequired) {
      stampPaperCount += 1;
      const denomination = rules.stampPaperDenominationInr;
      if (
        denomination != null &&
        (maxStampDenominationInr === null || denomination > maxStampDenominationInr)
      ) {
        maxStampDenominationInr = denomination;
      }
    }
    if (rules.notarizationRequired) notarizationCount += 1;
    if (rules.udinRequired) udinCount += 1;
    if (rules.signingAuthorityRank) signingAuthorityRanks.add(rules.signingAuthorityRank);
  }

  return {
    stampPaperCount,
    maxStampDenominationInr,
    notarizationCount,
    udinCount,
    signingAuthorityRanks: Array.from(signingAuthorityRanks).sort(),
  };
}

// ---------------------------------------------------------------------------
// Review-needed and flagged selections
// ---------------------------------------------------------------------------

/**
 * Requirements awaiting human action: PENDING/MISSING (not yet reviewed)
 * or explicitly marked humanReviewRequired. Sorted with PENDING/MISSING
 * first, then flagged, then alphabetically by requirement.
 */
export function getReviewNeededItems(items: ComplianceItem[]): ComplianceItem[] {
  const getTitle = (item: ComplianceItem) => (item as { title?: string }).title || item.requirement;
  const getStatus = (item: ComplianceItem): string => item.status;

  return items
    .filter(
      (i) => getStatus(i) === 'PENDING' || getStatus(i) === 'MISSING' || i.humanReviewRequired,
    )
    .sort((a, b) => {
      const aPending = getStatus(a) === 'PENDING' || getStatus(a) === 'MISSING' ? 0 : 1;
      const bPending = getStatus(b) === 'PENDING' || getStatus(b) === 'MISSING' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return getTitle(a).localeCompare(getTitle(b));
    });
}

// ---------------------------------------------------------------------------
// Deadline buffer (real input signal for the future decision engine)
// ---------------------------------------------------------------------------

/** Whole days between now and the submission deadline; null when unspecified. */
export function getDeadlineBufferDays(bid: BidDetail, nowMs: number): number | null {
  if (!bid.submissionDeadline) return null;
  const deadlineMs = new Date(bid.submissionDeadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;
  return Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Bid decision mapping (API response → web BidDecision)
// ---------------------------------------------------------------------------

/** Wire format from GET/POST /api/v1/bids/:id/bid-decision (BidsController.toDecisionWire) */
/** Wire format from GET/POST /api/v1/bids/:id/bid-decision (BidsController.toDecisionWire) */
export interface ApiBidDecisionSummary {
  decisionId: string;
  bidId: string;
  profileVersionId: string;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
  state: 'AI_PROPOSED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';
  readinessScore: number;
  evaluatedAt: string;
  reasonsToPursue?: Array<unknown>;
  reasonsNotToPursue?: Array<unknown>;
  hardDisqualifiers?: Array<unknown>;
  missingInformation?: Array<unknown>;
  uncertainAreas?: Array<unknown>;
  commercialRisks?: Array<unknown>;
  evidenceCitations?: unknown[];
  reviewTriggers?: unknown[];
}

/**
 * Maps the deterministic engine's wire response to the web's
 * `BidDecision` type. The engine uses GO/CONDITIONAL_GO/NO_GO/REVIEW_REQUIRED;
 * the web surfaces PURSUE/DO_NOT_PURSUE/REVIEW_REQUIRED.
 *
 * All reasons are flattened into a single evidence-backed string list without `undefined` artifacts.
 */
export function mapApiDecisionToBidDecision(api: ApiBidDecisionSummary): BidDecision {
  // GO → PURSUE, CONDITIONAL_GO → REVIEW_REQUIRED, NO_GO → DO_NOT_PURSUE, REVIEW_REQUIRED → REVIEW_REQUIRED
  const verdictMap: Record<ApiBidDecisionSummary['verdict'], BidRecommendation> = {
    GO: 'PURSUE',
    CONDITIONAL_GO: 'REVIEW_REQUIRED',
    NO_GO: 'DO_NOT_PURSUE',
    REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  };

  const verdict = verdictMap[api.verdict] ?? 'REVIEW_REQUIRED';
  const allReasons: string[] = [];

  if (verdict === 'DO_NOT_PURSUE') {
    // When DO NOT PURSUE, reasons must be the real disqualifying factors and deficits,
    // NEVER generic uncertain areas or operational risks!
    (api.hardDisqualifiers ?? []).forEach((d) => {
      const formatted = formatDisqualifierItem(d);
      if (formatted) allReasons.push(formatted);
    });

    (api.reasonsNotToPursue ?? []).forEach((r) => {
      const formatted = formatReasonItem(r);
      if (formatted) allReasons.push(formatted);
    });

    if (allReasons.length === 0) {
      (api.missingInformation ?? []).forEach((g) => {
        const formatted = formatMissingItem(g);
        if (formatted) allReasons.push(formatted);
      });
    }
  } else if (verdict === 'PURSUE') {
    (api.reasonsToPursue ?? []).forEach((r) => {
      const formatted = formatReasonItem(r);
      if (formatted) allReasons.push(formatted);
    });
  } else {
    // REVIEW_REQUIRED:
    (api.reasonsToPursue ?? []).forEach((r) => {
      const formatted = formatReasonItem(r);
      if (formatted) allReasons.push(formatted);
    });

    (api.reasonsNotToPursue ?? []).forEach((r) => {
      const formatted = formatReasonItem(r);
      if (formatted) allReasons.push(formatted);
    });

    (api.hardDisqualifiers ?? []).forEach((d) => {
      const formatted = formatDisqualifierItem(d);
      if (formatted) allReasons.push(formatted);
    });

    (api.missingInformation ?? []).forEach((g) => {
      const formatted = formatMissingItem(g);
      if (formatted) allReasons.push(formatted);
    });

    (api.uncertainAreas ?? []).forEach((u) => {
      const formatted = formatUncertainItem(u);
      if (formatted) allReasons.push(formatted);
    });

    (api.commercialRisks ?? []).forEach((r) => {
      const formatted = formatCommercialRiskItem(r);
      if (formatted) allReasons.push(formatted);
    });
  }

  return {
    bidId: api.bidId,
    decisionId: api.decisionId,
    profileVersionId: api.profileVersionId,
    verdict: verdictMap[api.verdict] ?? 'REVIEW_REQUIRED',
    state: api.state,
    readinessScore: api.readinessScore,
    reasons: allReasons,
    reasonsToPursue: api.reasonsToPursue,
    reasonsNotToPursue: api.reasonsNotToPursue,
    hardDisqualifiers: api.hardDisqualifiers,
    missingInformation: api.missingInformation,
    uncertainAreas: api.uncertainAreas,
    commercialRisks: api.commercialRisks,
    evidenceCitations: api.evidenceCitations,
    reviewTriggers: api.reviewTriggers,
    evaluatedAt: api.evaluatedAt,
    evaluatedFactors:
      (api.reasonsToPursue?.length ?? 0) +
      (api.reasonsNotToPursue?.length ?? 0) +
      (api.hardDisqualifiers?.length ?? 0) +
      (api.missingInformation?.length ?? 0) +
      (api.uncertainAreas?.length ?? 0) +
      (api.commercialRisks?.length ?? 0),
  };
}
