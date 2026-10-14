/**
 * DatabaseModule — Provides PGlite (embedded PostgreSQL) and Drizzle ORM as global injectables.
 *
 * Any module that needs type-safe query building injects 'DRIZZLE_TOKEN'.
 */
import { Module, Global } from '@nestjs/common';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { getDatabase, initDatabase } from './database.provider.js';
import * as schema from './schema.js';

export const DATABASE_TOKEN = 'DATABASE';
export const DRIZZLE_TOKEN = 'DRIZZLE';

export type DrizzleDb = PgliteDatabase<typeof schema>;

export function createDrizzle(db: PGlite): DrizzleDb {
  return drizzle(db, { schema });
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: async () => {
        const db = await getDatabase();
        await initDatabase(db);
        return db;
      },
    },
    {
      provide: DRIZZLE_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: PGlite): DrizzleDb => {
        return createDrizzle(db);
      },
    },
  ],
  exports: [DATABASE_TOKEN, DRIZZLE_TOKEN],
})
export class DatabaseModule {}
