/**
 * ComplianceService — CRUD + review operations for compliance items.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, asc, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { NotFoundError, ConflictError } from '../../common/errors/errors.js';
import type { DemoComplianceItem } from '../../seed/data.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

export interface ReviewComplianceDto {
  status?: DemoComplianceItem['status'];
  notes?: string | null;
  expectedVersion?: number;
}

export interface ReviewComplianceResult {
  id: string;
  status: DemoComplianceItem['status'];
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
}

export interface EvidenceMatchItem {
  complianceItemId: string;
  category: string;
  requirementTitle: string;
  description: string;
  status: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'EXPIRED';
  tenderCitation: DemoComplianceItem['provenance'];
  companyEvidence: DemoComplianceItem['companyEvidence'];
  executionRules: DemoComplianceItem['executionRules'];
}

export interface EvidenceMatchesResult {
  bidId: string;
  totalRequirements: number;
  totalMatched: number;
  totalPartial: number;
  totalUnmatched: number;
  coveragePct: number;
  matches: EvidenceMatchItem[];
}

export interface StatutoryRiskItem {
  complianceItemId: string;
  category: string;
  title: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  financialImpactRupees: number;
  mitigationAdvice: string | null;
  clauseCitation: string | null;
  executionConstraints: string[];
}

export interface CommercialRiskItem {
  riskId?: string;
  category: string;
  title?: string;
  summary: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  mitigationAdvice?: string | null;
  source: 'BID_DECISION' | 'REQUIREMENT_MATRIX';
}

export interface RiskFindingsResult {
  bidId: string;
  tenderNumber: string;
  summary: {
    totalRisks: number;
    criticalCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    statutoryComplianceRiskCount: number;
    commercialRiskCount: number;
    estimatedFinancialExposureRupees: number;
  };
  statutoryRisks: StatutoryRiskItem[];
  commercialRisks: CommercialRiskItem[];
  hardDisqualifiers: string[];
  uncertainAreas: string[];
  reviewTriggers: string[];
  evaluatedAt: string;
}

@Injectable()
export class ComplianceService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Resolves tenant organization ID from authenticated JWT context.
   * If TenantContext is missing (e.g. unauthenticated test harness), falls back to 'org_default'.
   */
  private getTenantOrgId(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (orgId) return orgId;
    return 'org_default';
  }

  public async listItems(bidId: string): Promise<DemoComplianceItem[]> {
    const orgId = this.getTenantOrgId();
    const records = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .orderBy(asc(schema.complianceItems.createdAt));

    const uniqueMap = new Map<string, (typeof records)[0]>();
    for (const row of records) {
      const key = `${row.category}:${row.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, row);
      } else {
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
        const curProv = (row.provenance ?? {}) as ProvenanceJson;
        const exProv = (existing.provenance ?? {}) as ProvenanceJson;
        const curQuote = curProv.verbatimQuote || '';
        const exQuote = exProv.verbatimQuote || '';
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

    return Array.from(uniqueMap.values()).map((row) => this.mapComplianceRecord(row));
  }

  public async getItemById(bidId: string, itemId: string): Promise<DemoComplianceItem> {
    const orgId = this.getTenantOrgId();
    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    return this.mapComplianceRecord(item);
  }

  /**
   * Review tasks — real projection of the compliance matrix:
   * requirements awaiting human action (status PENDING, REVIEW_REQUIRED, or humanReviewRequired).
   */
  public async listReviewTasks(bidId: string): Promise<DemoComplianceItem[]> {
    const items = await this.listItems(bidId);
    return items.filter(
      (item) =>
        item.status === 'PENDING' || item.status === 'REVIEW_REQUIRED' || item.humanReviewRequired,
    );
  }

  /**
   * Bid readiness rollup — server-side computation over the requirement matrix.
   */
  public async getReadinessRollup(bidId: string): Promise<{
    totalRequirements: number;
    ready: number;
    flagged: number;
    pending: number;
    waived: number;
    reviewRequired: number;
    reviewNeeded: number;
    readinessPct: number | null;
  }> {
    const items = await this.listItems(bidId);
    const total = items.length;
    const ready = items.filter((r) => r.status === 'READY' || r.status === 'PASS').length;
    const flagged = items.filter((r) => r.status === 'FLAGGED' || r.status === 'FAIL').length;
    const pending = items.filter((r) => r.status === 'PENDING' || r.status === 'MISSING').length;
    const waived = items.filter(
      (r) => r.status === 'WAIVED' || r.status === 'NOT_APPLICABLE',
    ).length;
    const reviewRequired = items.filter(
      (r) => r.status === 'REVIEW_REQUIRED' || r.humanReviewRequired,
    ).length;

    return {
      totalRequirements: total,
      ready,
      flagged,
      pending,
      waived,
      reviewRequired,
      reviewNeeded: pending + reviewRequired,
      readinessPct: total > 0 ? Math.round((ready / total) * 100) : null,
    };
  }

  /**
   * Evidence cross-matching projection for a bid.
   * Maps extracted tender requirements to company-side proof documents.
   */
  public async getEvidenceMatches(bidId: string): Promise<EvidenceMatchesResult> {
    const orgId = this.getTenantOrgId();

    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const items = await this.listItems(bidId);

    const matches: EvidenceMatchItem[] = items.map((item) => {
      const hasEvidence = !!item.companyEvidence && !!item.companyEvidence.id;
      let matchStatus: 'MATCHED' | 'UNMATCHED' | 'PARTIAL' | 'EXPIRED' = 'UNMATCHED';

      if (hasEvidence) {
        if (item.companyEvidence?.status === 'EXPIRED') {
          matchStatus = 'EXPIRED';
        } else if (item.companyEvidence?.status === 'MISSING') {
          matchStatus = 'UNMATCHED';
        } else if (
          item.companyEvidence?.status === 'SELF_ATTESTED' ||
          item.status === 'REVIEW_REQUIRED' ||
          item.humanReviewRequired
        ) {
          matchStatus = 'PARTIAL';
        } else {
          matchStatus = 'MATCHED';
        }
      }

      return {
        complianceItemId: item.id,
        category: item.category,
        requirementTitle: item.title,
        description: item.description,
        status: item.status,
        matchStatus,
        tenderCitation: item.provenance,
        companyEvidence: item.companyEvidence,
        executionRules: item.executionRules,
      };
    });

    const totalMatched = matches.filter((m) => m.matchStatus === 'MATCHED').length;
    const totalPartial = matches.filter((m) => m.matchStatus === 'PARTIAL').length;
    const totalUnmatched = matches.filter(
      (m) => m.matchStatus === 'UNMATCHED' || m.matchStatus === 'EXPIRED',
    ).length;

    return {
      bidId,
      totalRequirements: matches.length,
      totalMatched,
      totalPartial,
      totalUnmatched,
      coveragePct:
        matches.length > 0
          ? Math.round(((totalMatched + totalPartial * 0.5) / matches.length) * 100)
          : 0,
      matches,
    };
  }

  /**
   * Consolidated statutory, execution, and commercial risk radar for a bid.
   */
  public async getRiskFindings(bidId: string): Promise<RiskFindingsResult> {
    const orgId = this.getTenantOrgId();

    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }

    const mappedItems = await this.listItems(bidId);

    const [decisionRecord] = await this.db
      .select()
      .from(schema.bidDecisions)
      .where(
        and(eq(schema.bidDecisions.bidId, bidId), eq(schema.bidDecisions.organizationId, orgId)),
      )
      .orderBy(desc(schema.bidDecisions.createdAt));

    const statutoryRisks: StatutoryRiskItem[] = [];
    let estimatedFinancialExposureRupees = 0;

    for (const item of mappedItems) {
      const rules = item.executionRules;
      const constraints: string[] = [];
      if (rules?.stampPaperRequired) {
        constraints.push(
          `Non-Judicial Stamp Paper of ₹${rules.stampPaperDenominationInr ?? 100} required`,
        );
      }
      if (rules?.notarizationRequired) {
        constraints.push('Notarization by Notary Public / Oath Commissioner required');
      }
      if (rules?.udinRequired) {
        constraints.push('Chartered Accountant ICAI UDIN verification required');
      }
      if (rules?.signingAuthorityRank) {
        constraints.push(`Signing authority rank: ${rules.signingAuthorityRank}`);
      }

      if (item.risk || item.status === 'FLAGGED' || item.status === 'FAIL') {
        const rawLevel = item.risk?.level?.toUpperCase();
        const level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
          rawLevel === 'CRITICAL' ||
          rawLevel === 'HIGH' ||
          rawLevel === 'MEDIUM' ||
          rawLevel === 'LOW'
            ? rawLevel
            : item.status === 'FAIL'
              ? 'CRITICAL'
              : 'MEDIUM';

        const impact = Number(item.risk?.financialImpactRupees) || 0;
        estimatedFinancialExposureRupees += impact;

        statutoryRisks.push({
          complianceItemId: item.id,
          category: item.category,
          title: item.title,
          level,
          summary: item.risk?.summary || item.description,
          financialImpactRupees: impact,
          mitigationAdvice: item.risk?.mitigation || item.reviewNotes || null,
          clauseCitation: item.provenance?.sectionOrClause || null,
          executionConstraints: constraints,
        });
      }
    }

    const commercialRisks: CommercialRiskItem[] = [];
    let hardDisqualifiers: string[] = [];
    let uncertainAreas: string[] = [];
    let reviewTriggers: string[] = [];

    if (decisionRecord) {
      const decisionResponse =
        typeof decisionRecord.response === 'string'
          ? JSON.parse(decisionRecord.response)
          : (decisionRecord.response as Record<string, unknown>);

      if (decisionResponse && typeof decisionResponse === 'object') {
        if (Array.isArray(decisionResponse.commercial_risks)) {
          for (const cr of decisionResponse.commercial_risks) {
            if (typeof cr === 'string') {
              commercialRisks.push({
                category: 'COMMERCIAL',
                summary: cr,
                level: 'HIGH',
                source: 'BID_DECISION',
              });
            } else if (typeof cr === 'object' && cr !== null) {
              const obj = cr as Record<string, unknown>;
              const rawLevel = String(obj.level || 'MEDIUM').toUpperCase();
              const level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
                rawLevel === 'CRITICAL' ||
                rawLevel === 'HIGH' ||
                rawLevel === 'MEDIUM' ||
                rawLevel === 'LOW'
                  ? (rawLevel as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
                  : 'MEDIUM';

              commercialRisks.push({
                category: String(obj.category || 'COMMERCIAL'),
                title:
                  typeof obj.title === 'string'
                    ? obj.title
                    : typeof obj.risk_type === 'string'
                      ? obj.risk_type
                      : undefined,
                summary: String(obj.summary || obj.description || obj.detail || ''),
                level,
                mitigationAdvice:
                  typeof obj.mitigation_advice === 'string'
                    ? obj.mitigation_advice
                    : typeof obj.mitigation === 'string'
                      ? obj.mitigation
                      : null,
                source: 'BID_DECISION',
              });
            }
          }
        }

        if (Array.isArray(decisionResponse.hard_disqualifiers)) {
          hardDisqualifiers = decisionResponse.hard_disqualifiers.map((d: unknown) =>
            typeof d === 'string' ? d : JSON.stringify(d),
          );
        }
        if (Array.isArray(decisionResponse.uncertain_areas)) {
          uncertainAreas = decisionResponse.uncertain_areas.map((u: unknown) =>
            typeof u === 'string' ? u : JSON.stringify(u),
          );
        }
        if (Array.isArray(decisionResponse.review_triggers)) {
          reviewTriggers = decisionResponse.review_triggers.map((t: unknown) =>
            typeof t === 'string' ? t : JSON.stringify(t),
          );
        }
      }
    }

    const allRisks = [...statutoryRisks, ...commercialRisks];
    const criticalCount = allRisks.filter((r) => r.level === 'CRITICAL').length;
    const highCount = allRisks.filter((r) => r.level === 'HIGH').length;
    const mediumCount = allRisks.filter((r) => r.level === 'MEDIUM').length;
    const lowCount = allRisks.filter((r) => r.level === 'LOW').length;

    return {
      bidId,
      tenderNumber: bid.tenderNumber,
      summary: {
        totalRisks: allRisks.length,
        criticalCount,
        highSeverityCount: highCount,
        mediumSeverityCount: mediumCount,
        lowSeverityCount: lowCount,
        statutoryComplianceRiskCount: statutoryRisks.length,
        commercialRiskCount: commercialRisks.length,
        estimatedFinancialExposureRupees,
      },
      statutoryRisks,
      commercialRisks,
      hardDisqualifiers,
      uncertainAreas,
      reviewTriggers,
      evaluatedAt: new Date().toISOString(),
    };
  }

  public async reviewItem(
    bidId: string,
    itemId: string,
    dto: ReviewComplianceDto,
  ): Promise<ReviewComplianceResult> {
    const orgId = this.getTenantOrgId();
    const userId = TenantContextHolder.get()?.userId || 'usr_reviewer';
    const reviewer = 'Reviewer';

    const [item] = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundError(`Compliance item '${itemId}' not found.`);
    }

    // Optimistic concurrency check
    if (dto.expectedVersion != null && item.version !== dto.expectedVersion) {
      throw new ConflictError(
        `Conflict: Item has been modified by another reviewer (Version ${item.version}). Please refresh.`,
      );
    }

    const validStatuses: DemoComplianceItem['status'][] = [
      'PENDING',
      'READY',
      'FLAGGED',
      'WAIVED',
      'PASS',
      'FAIL',
      'MISSING',
      'REVIEW_REQUIRED',
      'NOT_APPLICABLE',
    ];
    const newStatus =
      typeof dto.status === 'string' && (validStatuses as string[]).includes(dto.status)
        ? (dto.status as DemoComplianceItem['status'])
        : (item.status as DemoComplianceItem['status']);
    const newNotes =
      typeof dto.notes === 'string' ? dto.notes : dto.notes === null ? null : item.reviewNotes;
    const now = new Date();
    const nextVersion = item.version + 1;

    // If human reviewed with PASS/READY/WAIVED/NOT_APPLICABLE, resolve humanReviewRequired
    const isResolved =
      newStatus === 'PASS' ||
      newStatus === 'READY' ||
      newStatus === 'WAIVED' ||
      newStatus === 'NOT_APPLICABLE';

    await this.db
      .update(schema.complianceItems)
      .set({
        status: newStatus,
        reviewNotes: newNotes,
        reviewedBy: reviewer,
        reviewedAt: now,
        humanReviewRequired: isResolved ? false : item.humanReviewRequired,
        version: nextVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.complianceItems.id, itemId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    // Recalculate summary metrics on bid in PostgreSQL
    const allItems = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );

    const approvedCount = allItems.filter((i) => {
      const st = i.id === itemId ? newStatus : i.status;
      return st === 'READY' || st === 'PASS';
    }).length;
    const flaggedCount = allItems.filter((i) => {
      const st = i.id === itemId ? newStatus : i.status;
      return st === 'FLAGGED' || st === 'FAIL';
    }).length;
    const totalCount = allItems.length;

    await this.db
      .update(schema.bids)
      .set({
        approvedRequirements: approvedCount,
        flaggedRequirements: flaggedCount,
        totalRequirements: totalCount,
        updatedAt: now,
      })
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)));

    // Record audit event in PostgreSQL
    await this.db.insert(schema.auditLogs).values({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      bidId,
      organizationId: orgId,
      userId,
      userName: reviewer,
      eventType: `COMPLIANCE_ITEM_${newStatus}`,
      aggregateType: 'ComplianceItem',
      aggregateId: itemId,
      payload: {
        title: item.title,
        status: newStatus,
        notes: newNotes,
        version: nextVersion,
      },
      timestamp: now,
    });

    return {
      id: item.id,
      status: newStatus,
      reviewNotes: newNotes,
      reviewedBy: reviewer,
      reviewedAt: now.toISOString(),
      version: nextVersion,
    };
  }

  public async bulkReviewItems(
    bidId: string,
    items: Array<{
      id: string;
      status: DemoComplianceItem['status'];
      notes?: string | null;
      expectedVersion?: number;
    }>,
  ): Promise<ReviewComplianceResult[]> {
    const results: ReviewComplianceResult[] = [];
    for (const item of items) {
      const res = await this.reviewItem(bidId, item.id, {
        status: item.status,
        notes: item.notes,
        expectedVersion: item.expectedVersion,
      });
      results.push(res);
    }
    return results;
  }

  private mapComplianceRecord(record: schema.ComplianceItem): DemoComplianceItem {
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
    const sourceCitation = {
      document: String(prov.documentName || 'NIT Tender Document'),
      page: Number(prov.pageNumber || 1),
      section: String(prov.sectionOrClause || prov.clauseReference || ''),
      verbatimQuote: String(prov.verbatimQuote || record.description || ''),
      confidenceScore: Number(prov.confidenceScore || 0.9),
    };

    return {
      id: record.id,
      bidId: record.bidId,
      category: record.category as DemoComplianceItem['category'],
      title: record.title,
      requirement: record.title,
      description: record.description,
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
}
