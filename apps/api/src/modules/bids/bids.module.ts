/**
 * BidsModule — Bid project management feature module.
 */
import { Module } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { BidsController } from './bids.controller.js';
import { BidsService } from './bids.service.js';
import { BID_REPOSITORY_TOKEN } from './domain/repositories/IBidRepository.js';
import { PostgresBidRepository } from '../../infrastructure/persistence/PostgresBidRepository.js';
import { DATABASE_TOKEN } from '../../common/database/database.module.js';
import { ComplianceModule } from '../compliance/compliance.module.js';
import { GetBidDecisionUseCase, AI_DECISION_CLIENT_TOKEN } from './application/GetBidDecisionUseCase.js';
import { AiDecisionClient } from './application/AiDecisionClient.js';

@Module({
  imports: [ComplianceModule],
  controllers: [BidsController],
  providers: [
    BidsService,
    GetBidDecisionUseCase,
    {
      provide: AI_DECISION_CLIENT_TOKEN,
      useClass: AiDecisionClient,
    },
    {
      provide: BID_REPOSITORY_TOKEN,
      useFactory: (db: PGlite) => new PostgresBidRepository(db),
      inject: [DATABASE_TOKEN],
    },
  ],
  exports: [BidsService, BID_REPOSITORY_TOKEN, GetBidDecisionUseCase],
})
export class BidsModule { }
