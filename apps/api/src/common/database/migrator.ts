/**
 * Versioned schema migrator.
 *
 * Applies pending migrations in order, each in its own transaction, and records them
 * in schema_migrations with a checksum. A Postgres advisory lock makes concurrent API
 * instances (e.g. several ECS tasks starting together) wait instead of racing.
 */
import { createHash } from 'node:crypto';
import { withSession, type DatabaseClient, type SqlSession } from './client.js';
import { MIGRATIONS, type Migration } from './migrations/index.js';

// Arbitrary but fixed 64-bit key for pg_advisory_lock.
const MIGRATION_LOCK_KEY = 7_311_204_601;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function ensureLedger(session: SqlSession): Promise<void> {
  await session.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function runMigrations(
  client: DatabaseClient,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<MigrationResult> {
  return withSession(client, async (session) => {
    await session.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await ensureLedger(session);
      const rows = await session.query<{ id: string; checksum: string }>(
        'SELECT id, checksum FROM schema_migrations',
      );
      const applied = new Map(rows.map((r) => [r.id, r.checksum]));
      const result: MigrationResult = { applied: [], skipped: [] };

      for (const migration of migrations) {
        const sum = checksum(migration.sql);
        const previous = applied.get(migration.id);
        if (previous !== undefined) {
          if (previous !== sum) {
            throw new Error(
              `Migration ${migration.id} was edited after it was applied (checksum mismatch). ` +
                'Revert the edit and add a new migration instead.',
            );
          }
          result.skipped.push(migration.id);
          continue;
        }
        await session.exec('BEGIN');
        try {
          await session.exec(migration.sql);
          await session.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [
            migration.id,
            sum,
          ]);
          await session.exec('COMMIT');
        } catch (err) {
          await session.exec('ROLLBACK');
          throw new Error(
            `Migration ${migration.id} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        result.applied.push(migration.id);
      }
      return result;
    } finally {
      await session.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  });
}
