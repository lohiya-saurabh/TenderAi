/**
 * GetBidDecisionUseCase — answers "Should we bid on
 * this tender?" using the deterministic eligibility
 * engine in the AI service.
 *
 * Flow:
 *   1. Load the bid (tenant-scoped, anti-IDOR)
 *   2. Map stored compliance requirements to engine
 *      RequirementCandidates (deterministic mapping)
 *   3. Load the tenant's pinned Company Capability
 *      Profile (the factual basis of the verdict)
 *   4. Assemble the engine request (security context
 *      with purpose BID_DECISION)
 *   5. Call the AI engine — the LLM never computes
 *      the verdict; DeterministicEligibilityEvaluator
 *      does, from structured facts only
 *   6. Persist the decision as an immutable audit
 *      record and return it
 *
 * Failure modes are explicit: no profile → 409 with
 * an actionable message; engine unreachable → the
 * error propagates (the caller must never fabricate
 * a verdict); missing deadline → 400.
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '../../../common/database/database.module.js';
import * as schema from '../../../common/database/schema.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../../common/errors/errors.js';
import { TenantContextHolder } from '../../../common/security/TenantContext.js';
import {
  AiDecisionClient,
  type AiBidDecisionRequest,
  type AiBidDecisionResponse,
  type AiCompanyProfileSnapshot,
} from './AiDecisionClient.js';
import { toRequirementCandidates, type RequirementSourceItem } from './RequirementMapper.js';

export interface BidDecisionEvaluationResult {
  decisionId: string;
  bidId: string;
  profileVersionId: string;
  verdict: AiBidDecisionResponse['verdict'];
  state: AiBidDecisionResponse['state'];
  readinessScore: number;
  evaluatedAt: string;
  response: AiBidDecisionResponse;
}

export const AI_DECISION_CLIENT_TOKEN = 'AI_DECISION_CLIENT';

@Injectable()
export class GetBidDecisionUseCase {
  private readonly db: DrizzleDb;

  constructor(
    @Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite,
    @Optional()
    @Inject(AI_DECISION_CLIENT_TOKEN)
    private readonly aiDecisionClient: AiDecisionClient | null = null,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /** Latest persisted decision for the bid, or null. */
  public async getLatestDecision(bidId: string): Promise<BidDecisionEvaluationResult | null> {
    const orgId = this.requireOrg();

    await this.requireBid(bidId, orgId);

    const [record] = await this.db
      .select()
      .from(schema.bidDecisions)
      .where(
        and(eq(schema.bidDecisions.bidId, bidId), eq(schema.bidDecisions.organizationId, orgId)),
      )
      .orderBy(desc(schema.bidDecisions.createdAt))
      .limit(1);

    return record ? this.mapDecisionRecord(record) : null;
  }

  /**
   * Runs a fresh evaluation against the pinned
   * company profile and persists the result.
   */
  public async evaluate(bidId: string): Promise<BidDecisionEvaluationResult> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId || 'usr_bid_mgr_01';

    const bid = await this.requireBid(bidId, orgId);

    if (!bid.submissionDeadline) {
      throw new BadRequestError(
        `Bid '${bidId}' has no submission deadline. A deadline is required for bid-decision evaluation.`,
      );
    }

    // 1. Requirements from the stored compliance matrix
    const complianceItems = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      );
    const requirements = toRequirementCandidates(
      // JSONB columns (executionRules, provenance) are stored as
      // parsed objects by PGlite; cast to the structural source shape.
      complianceItems as unknown as RequirementSourceItem[],
    );

    // 2. Pinned company profile for the bid's company
    const targetCompanyId = bid.companyId;

    const pointerCondition = targetCompanyId
      ? and(
          eq(schema.companyProfiles.organizationId, orgId),
          eq(schema.companyProfiles.companyId, targetCompanyId),
        )
      : eq(schema.companyProfiles.organizationId, orgId);

    const [pointer] = await this.db
      .select()
      .from(schema.companyProfiles)
      .where(pointerCondition)
      .limit(1);

    if (!pointer) {
      throw new ConflictError(
        `No Company Capability Profile is configured for company '${targetCompanyId || orgId}'. ` +
          'Pin a profile before evaluating a bid decision.',
      );
    }

    const [profileVersion] = await this.db
      .select()
      .from(schema.companyProfileVersions)
      .where(
        and(
          eq(schema.companyProfileVersions.id, pointer.activeVersionId),
          eq(schema.companyProfileVersions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!profileVersion) {
      throw new ConflictError(
        `Active company profile version '${pointer.activeVersionId}' is missing. Re-pin a profile via Company Profile settings.`,
      );
    }

    const payload =
      typeof profileVersion.payload === 'string'
        ? JSON.parse(profileVersion.payload)
        : profileVersion.payload;

    // 3. Document allow-list for the security context
    const documents = await this.db
      .select({ id: schema.tenderDocuments.id })
      .from(schema.tenderDocuments)
      .where(
        and(
          eq(schema.tenderDocuments.bidId, bidId),
          eq(schema.tenderDocuments.organizationId, orgId),
        ),
      );

    // 4. Assemble the engine request
    const companyProfile: AiCompanyProfileSnapshot = {
      company_id: pointer.companyId || orgId,
      company_name: payload.company_name ?? 'Unknown Company',
      profile_version_id: profileVersion.id,
      is_active: true,
      is_blacklisted: Boolean(payload.is_blacklisted),
      registrations: payload.registrations ?? {},
      operating_regions: payload.operating_regions ?? [],
      turnover_records: payload.turnover_records ?? [],
      experience: payload.experience ?? [],
      certifications: payload.certifications ?? [],
      oem_authorizations: payload.oem_authorizations ?? [],
      staff: payload.staff ?? [],
      equipment: payload.equipment ?? [],
    };

    const submissionDeadlineDate = new Date(bid.submissionDeadline);
    const request: AiBidDecisionRequest = {
      security_context: {
        tenant_id: orgId,
        user_id: userId,
        company_id: pointer.companyId,
        workflow_run_id: `run-bid-decision-${bidId}-${Date.now()}`,
        allowed_document_ids: documents.map((d) => d.id),
        allowed_source_ids: [],
        purpose: 'BID_DECISION',
      },
      tender_id: bidId,
      tender_title: bid.title,
      estimated_value_inr_crores: Number(bid.estimatedValueRupees) / 1e7,
      submission_deadline: submissionDeadlineDate.toISOString().slice(0, 10),
      project_location_state: bid.locationState?.trim() || 'UNSPECIFIED',
      requirements,
      company_profile: companyProfile,
      require_human_review: true,
    };

    // 5. Call the deterministic engine
    const client = this.aiDecisionClient ?? new AiDecisionClient();
    const response = await client.evaluate(request);

    // 6. Persist the immutable decision record
    const decisionId = `bd-${bidId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    await this.db.insert(schema.bidDecisions).values({
      id: decisionId,
      bidId,
      companyId: pointer.companyId,
      organizationId: orgId,
      profileVersionId: profileVersion.id,
      verdict: response.verdict,
      state: response.state,
      readinessScore: response.readiness_score,
      response: response as unknown as Record<string, unknown>,
      createdAt: now,
    });

    return {
      decisionId,
      bidId,
      profileVersionId: profileVersion.id,
      verdict: response.verdict,
      state: response.state,
      readinessScore: response.readiness_score,
      evaluatedAt: now.toISOString(),
      response,
    };
  }

  private async requireBid(bidId: string, orgId: string): Promise<schema.Bid> {
    const [bid] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    if (!bid) {
      throw new NotFoundError(`Bid project '${bidId}' not found.`);
    }
    return bid;
  }

  private mapDecisionRecord(record: schema.BidDecision): BidDecisionEvaluationResult {
    const response =
      typeof record.response === 'string' ? JSON.parse(record.response) : record.response;
    return {
      decisionId: record.id,
      bidId: record.bidId,
      profileVersionId: record.profileVersionId,
      verdict: (response as AiBidDecisionResponse).verdict,
      state: (response as AiBidDecisionResponse).state,
      readinessScore: record.readinessScore,
      evaluatedAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : String(record.createdAt),
      response: response as AiBidDecisionResponse,
    };
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Tenant context is required for bid-decision evaluation.');
    }
    return orgId;
  }
}
