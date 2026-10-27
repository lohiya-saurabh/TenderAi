/**
 * ClausesController — Phase 1 clause contract endpoints (see packages/shared-types clause.ts).
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  BulkReviewRequest,
  ClauseReviewRequest,
  ConflictResolutionRequest,
} from '@tenderpulse/shared-types';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';
import { ClausesService } from './clauses.service.js';

@Controller('api/v1/bids/:bidId')
export class ClausesController {
  constructor(@Inject(ClausesService) private readonly service: ClausesService) {}

  @Get('clauses')
  @RequirePermission(Permissions.BIDS_READ)
  async list(
    @Param('bidId') bidId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, etag } = await this.service.list(bidId);
    res.setHeader('ETag', etag);
    if (ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }
    return body;
  }

  @Post('clauses/bulk-review')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPLIANCE_REVIEW)
  async bulkReview(@Param('bidId') bidId: string, @Body() body: BulkReviewRequest) {
    return this.service.bulkReview(bidId, body);
  }

  @Get('clauses/:clauseId')
  @RequirePermission(Permissions.BIDS_READ)
  async detail(@Param('bidId') bidId: string, @Param('clauseId') clauseId: string) {
    return this.service.detail(bidId, clauseId);
  }

  @Post('clauses/:clauseId/review')
  @HttpCode(200)
  @RequirePermission(Permissions.COMPLIANCE_REVIEW)
  async review(
    @Param('bidId') bidId: string,
    @Param('clauseId') clauseId: string,
    @Body() body: ClauseReviewRequest,
  ) {
    return this.service.review(bidId, clauseId, body);
  }

  @Get('conflicts')
  @RequirePermission(Permissions.BIDS_READ)
  async conflicts(@Param('bidId') bidId: string) {
    return this.service.conflicts(bidId);
  }

  @Patch('conflicts/:conflictId')
  @RequirePermission(Permissions.COMPLIANCE_REVIEW)
  async resolveConflict(
    @Param('bidId') bidId: string,
    @Param('conflictId') conflictId: string,
    @Body() body: ConflictResolutionRequest,
  ) {
    return this.service.resolveConflict(bidId, conflictId, body);
  }

  @Get('coverage')
  @RequirePermission(Permissions.BIDS_READ)
  async coverage(@Param('bidId') bidId: string) {
    return this.service.coverage(bidId);
  }

  @Get('summary')
  @RequirePermission(Permissions.BIDS_READ)
  async summary(@Param('bidId') bidId: string) {
    return this.service.summary(bidId);
  }

  @Get('documents/:documentId/pages/:page')
  @RequirePermission(Permissions.BIDS_READ)
  async pageText(
    @Param('bidId') bidId: string,
    @Param('documentId') documentId: string,
    @Param('page', ParseIntPipe) page: number,
  ) {
    return this.service.pageText(bidId, documentId, page);
  }
}
