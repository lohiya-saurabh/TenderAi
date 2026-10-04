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

@Module({
  controllers: [BidsController],
  providers: [
    BidsService,
    {
      provide: BID_REPOSITORY_TOKEN,
      useFactory: (db: PGlite) => new PostgresBidRepository(db),
      inject: [DATABASE_TOKEN],
    },
  ],
  exports: [BidsService, BID_REPOSITORY_TOKEN],
})
export class BidsModule { }
