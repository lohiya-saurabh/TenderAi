/**
 * DatabaseModule — provides the PostgreSQL client and Drizzle ORM as global injectables.
 *
 * Runtime uses real PostgreSQL via DATABASE_URL (node-postgres pool). Tests use
 * in-memory PGlite via PGLITE_DATA_DIR. Any module that needs type-safe query
 * building injects 'DRIZZLE_TOKEN'.
 */
import { Module, Global, Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { getDatabase, initDatabase } from '@/common/database/database.provider.js';
import {
  closeDatabase,
  createDrizzleFor,
  type DatabaseClient,
  type DrizzleDb,
} from '@/common/database/client.js';
import * as schema from '@/common/database/schema.js';

export type { DrizzleDb } from '@/common/database/client.js';

export const DATABASE_TOKEN = 'DATABASE';
export const DRIZZLE_TOKEN = 'DRIZZLE';

/** Wraps an in-memory/embedded PGlite (tests) in Drizzle. */
export function createDrizzle(db: PGlite): DrizzleDb {
  return drizzle(db, { schema }) as unknown as DrizzleDb;
}

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_TOKEN) private readonly client: DatabaseClient) {}

  async onApplicationShutdown(): Promise<void> {
    await closeDatabase(this.client);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const db = await getDatabase(configService);
        await initDatabase(db, undefined, configService);
        return db;
      },
    },
    {
      provide: DRIZZLE_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: DatabaseClient): DrizzleDb => createDrizzleFor(db),
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_TOKEN, DRIZZLE_TOKEN],
})
export class DatabaseModule {}
