import type { DatabaseClient } from './client.js';
import { runMigrations } from './migrator.js';

/**
 * @deprecated Kept for existing callers; the schema now lives in versioned migrations
 * (./migrations). Equivalent to runMigrations().
 */
export async function initDatabaseDdl(db: DatabaseClient): Promise<void> {
  await runMigrations(db);
}
