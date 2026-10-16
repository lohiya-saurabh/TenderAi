/**
 * BidsModule — Bid project management feature module.
 */
import { Module } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { BidsController } from '@/modules/bids/bids.controller.js';
import { TendersController } from '@/modules/bids/tenders.controller.js';
import { BidsService } from '@/modules/bids/bids.service.js';
import { BID_REPOSITORY_TOKEN } from '@/modules/bids/domain/repositories/IBidRepository.js';
import { PostgresBidRepository } from '@/infrastructure/persistence/PostgresBidRepository.js';
import { DATABASE_TOKEN } from '@/common/database/database.module.js';
import { ComplianceModule } from '@/modules/compliance/compliance.module.js';
import {
  GetBidDecisionUseCase,
  AI_DECISION_CLIENT_TOKEN,
} from '@/modules/bids/application/GetBidDecisionUseCase.js';
import { AiDecisionClient } from '@/modules/bids/application/AiDecisionClient.js';

@Module({
  imports: [ComplianceModule],
  controllers: [BidsController, TendersController],
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
export class BidsModule {}
