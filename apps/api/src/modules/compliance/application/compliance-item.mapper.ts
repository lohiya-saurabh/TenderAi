import type * as schema from '@/common/database/schema.js';
import type { DemoComplianceItem } from '@/seed/data.js';

interface ProvenanceJson {
  verbatimQuote?: string;
  confidenceScore?: number;
  pageNumber?: number;
  clauseReference?: string;
}

interface ExecutionRulesJson {
  stampPaperRequired?: boolean;
  stampPaperDenominationInr?: number;
  notarizationRequired?: boolean;
  udinRequired?: boolean;
  signingAuthorityRank?: string;
}

/**
 * Deduplicates and reconciles overlapping compliance requirements.
 */
export function deduplicateComplianceItems(
  records: schema.ComplianceItem[],
): schema.ComplianceItem[] {
  const uniqueMap = new Map<string, schema.ComplianceItem>();
  for (const row of records) {
    const key = `${row.category}:${row.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    const existing = uniqueMap.get(key);
    if (!existing) {
      uniqueMap.set(key, row);
    } else {
      const curProv = (row.provenance ?? {}) as ProvenanceJson;
      const exProv = (existing.provenance ?? {}) as ProvenanceJson;
      const curQuote = String(curProv.verbatimQuote || '').replace(/\s+/g, ' ').trim();
      const exQuote = String(exProv.verbatimQuote || '').replace(/\s+/g, ' ').trim();
      const preferCur =
        (!exQuote && Boolean(curQuote)) ||
        (exQuote.length < 50 && curQuote.length >= 50) ||
        ((curProv.confidenceScore || 0) > (exProv.confidenceScore || 0) && curQuote.length >= 40);

      const chosen = preferCur ? row : existing;
      const other = preferCur ? existing : row;
      const chosenRules = (chosen.executionRules ?? {}) as ExecutionRulesJson;
      const otherRules = (other.executionRules ?? {}) as ExecutionRulesJson;

      const mergedRules = {
        ...otherRules,
        ...chosenRules,
        stampPaperRequired: Boolean(
          chosenRules.stampPaperRequired || otherRules.stampPaperRequired,
        ),
        stampPaperDenominationInr:
          Math.max(
            chosenRules.stampPaperDenominationInr || 0,
            otherRules.stampPaperDenominationInr || 0,
          ) || undefined,
        notarizationRequired: Boolean(
          chosenRules.notarizationRequired || otherRules.notarizationRequired,
        ),
        udinRequired: Boolean(chosenRules.udinRequired || otherRules.udinRequired),
      };

      uniqueMap.set(key, {
        ...chosen,
        executionRules: mergedRules,
      });
    }
  }
  return Array.from(uniqueMap.values());
}

/**
 * Projects a raw database ComplianceItem record into an API DTO.
 */
export function mapComplianceRecord(record: schema.ComplianceItem): DemoComplianceItem {
  const executionRules =
    typeof record.executionRules === 'string'
      ? JSON.parse(record.executionRules)
      : (record.executionRules as DemoComplianceItem['executionRules']);
  const provenance =
    typeof record.provenance === 'string'
      ? JSON.parse(record.provenance)
      : (record.provenance as DemoComplianceItem['provenance']);
  const companyEvidence =
    typeof record.companyEvidence === 'string'
      ? JSON.parse(record.companyEvidence)
      : (record.companyEvidence as DemoComplianceItem['companyEvidence']);
  const risk =
    typeof record.risk === 'string'
      ? JSON.parse(record.risk)
      : (record.risk as DemoComplianceItem['risk']);
  const rationale =
    typeof record.rationale === 'string'
      ? JSON.parse(record.rationale)
      : (record.rationale as DemoComplianceItem['rationale']);

  const prov = (provenance ?? {}) as Record<string, unknown>;
  const rawClause = String(prov.clauseReference || prov.sectionOrClause || '').trim();
  const cleanedClause = rawClause
    .replace(/\s*\(Pages?\s+[\d,\s]+\)\s*$/i, '') // Strip trailing "(Page 6)" or "(Pages 2, 6)"
    .replace(/^(?:Clauses?|Sections?)\s+(?:on|across)\s+Pages?\s+[\d,\s]+$/i, '') // Drop generic "Clause on Page 4"
    .replace(/^Pages?\s+[\d,\s]+$/i, '') // Drop bare "Page 4" or "Pages 2, 6"
    .replace(/^(?:Clause|Section|Page)\s+/i, '')
    .trim();

  const tenderClauseRef = cleanedClause || undefined;
  const cleanQuote = String(prov.verbatimQuote || record.description || '').replace(/\s+/g, ' ').trim();

  const sourceCitation = {
    document: String(prov.documentName || 'NIT Tender Document'),
    page: Number(prov.pageNumber || 1),
    section: String(prov.sectionOrClause || prov.clauseReference || ''),
    verbatimQuote: cleanQuote,
    confidenceScore: Number(prov.confidenceScore || 0.9),
  };

  return {
    id: record.id,
    bidId: record.bidId,
    category: record.category as DemoComplianceItem['category'],
    title: record.title,
    requirement: record.title,
    description: record.description,
    tenderClauseRef,
    status: record.status as DemoComplianceItem['status'],
    humanReviewRequired: record.humanReviewRequired,
    reviewNotes: record.reviewNotes,
    reviewedBy: record.reviewedBy,
    reviewedAt:
      record.reviewedAt instanceof Date
        ? record.reviewedAt.toISOString()
        : record.reviewedAt
          ? String(record.reviewedAt)
          : null,
    version: record.version,
    executionRules,
    provenance,
    sourceCitation,
    companyEvidence: companyEvidence ?? null,
    risk: risk ?? null,
    rationale: rationale ?? null,
    createdAt:
      record.createdAt instanceof Date
        ? record.createdAt.toISOString()
        : String(record.createdAt),
    updatedAt:
      record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : String(record.updatedAt),
  };
}
