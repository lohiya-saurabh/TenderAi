/**
 * BidsController — NestJS controller for bid project endpoints with RBAC guards.
 */
import { Controller, Get, Post, Delete, Param, Query, Body, HttpCode } from '@nestjs/common';
import { BidsService, type ListBidsQuery } from './bids.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { GetBidDecisionUseCase } from './application/GetBidDecisionUseCase.js';
import { RequirePermission } from '../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../common/security/permissions.js';
import { NotFoundError } from '../../common/errors/errors.js';

@Controller('api/v1/bids')
export class BidsController {
  constructor(
    private readonly bidsService: BidsService,
    private readonly complianceService: ComplianceService,
    private readonly bidDecisionUseCase: GetBidDecisionUseCase,
  ) {}

  @Get()
  @RequirePermission(Permissions.BIDS_READ)
  async list(@Query() query?: ListBidsQuery) {
    return this.bidsService.listBids(query);
  }

  @Get(':id')
  @RequirePermission(Permissions.BIDS_READ)
  async getById(@Param('id') id: string) {
    return this.bidsService.getBidById(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permissions.BIDS_CREATE)
  async create(
    @Body()
    body: {
      companyId?: string;
      title?: string;
      tenderNumber?: string;
      tenderingAuthority?: string;
      estimatedValueRupees?: number | string;
      submissionDeadline?: string | null;
      locationState?: string | null;
    },
  ) {
    const newBid = await this.bidsService.createBid(body);
    return {
      bidId: newBid.id,
      companyId: newBid.companyId,
      title: newBid.title,
      tenderNumber: newBid.tenderNumber,
      tenderingAuthority: newBid.tenderingAuthority,
      status: newBid.status,
      createdAt: newBid.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_DELETE)
  async delete(@Param('id') id: string) {
    return this.bidsService.deleteBid(id);
  }

  // -------------------------------------------------------------------------
  // Bid decision — "Should we bid on this tender?"
  // -------------------------------------------------------------------------

  /**
   * Latest persisted decision for this bid.
   * Returns 404 when the bid has never been evaluated.
   */
  @Get(':id/bid-decision')
  @RequirePermission(Permissions.BIDS_READ)
  async getBidDecision(@Param('id') id: string) {
    const decision = await this.bidDecisionUseCase.getLatestDecision(id);
    if (!decision) {
      throw new NotFoundError(
        `No bid decision has been evaluated for bid '${id}' yet. POST /api/v1/bids/${id}/bid-decision to run the evaluation.`,
      );
    }
    return this.toDecisionWire(decision);
  }

  /**
   * Runs a fresh deterministic evaluation against the
   * pinned Company Capability Profile and persists
   * the result. Requires BIDS_UPDATE (it writes a
   * decision record) and a configured profile.
   */
  @Post(':id/bid-decision')
  @HttpCode(201)
  @RequirePermission(Permissions.BIDS_UPDATE)
  async evaluateBidDecision(@Param('id') id: string) {
    const decision = await this.bidDecisionUseCase.evaluate(id);
    return this.toDecisionWire(decision);
  }

  // -------------------------------------------------------------------------
  // Compliance projections (review tasks, readiness)
  // -------------------------------------------------------------------------

  @Get(':id/review-tasks')
  @RequirePermission(Permissions.BIDS_READ)
  async listReviewTasks(@Param('id') id: string) {
    return this.complianceService.listReviewTasks(id);
  }

  @Get(':id/readiness')
  @RequirePermission(Permissions.BIDS_READ)
  async getReadiness(@Param('id') id: string) {
    return this.complianceService.getReadinessRollup(id);
  }

  @Get(':id/evidence-matches')
  @RequirePermission(Permissions.BIDS_READ)
  async getEvidenceMatches(@Param('id') id: string) {
    return this.complianceService.getEvidenceMatches(id);
  }

  @Get(':id/risk-findings')
  @RequirePermission(Permissions.BIDS_READ)
  async getRiskFindings(@Param('id') id: string) {
    return this.complianceService.getRiskFindings(id);
  }

  @Get(':id/deadlines')
  @RequirePermission(Permissions.BIDS_READ)
  async getDeadlines(@Param('id') id: string) {
    return this.bidsService.getTenderDeadlines(id);
  }

  @Get(':id/amendments')
  @RequirePermission(Permissions.BIDS_READ)
  async getAmendments(@Param('id') id: string) {
    return this.bidsService.getTenderAmendments(id);
  }

  private toDecisionWire(decision: Awaited<ReturnType<GetBidDecisionUseCase['evaluate']>>) {
    const { decisionId, bidId, profileVersionId, verdict, state, readinessScore, evaluatedAt, response } = decision;
    return {
      decisionId,
      bidId,
      profileVersionId,
      verdict,
      state,
      readinessScore,
      evaluatedAt,
      reasonsToPursue: response.reasons_to_pursue,
      reasonsNotToPursue: response.reasons_not_to_pursue,
      hardDisqualifiers: response.hard_disqualifiers,
      missingInformation: response.missing_information,
      uncertainAreas: response.uncertain_areas,
      commercialRisks: response.commercial_risks,
      evidenceCitations: response.evidence_citations,
      reviewTriggers: response.review_triggers,
    };
  }
}
