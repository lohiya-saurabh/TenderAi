import * as schema from '@/common/database/schema.js';
import type { DrizzleDb } from '@/common/database/database.module.js';

/**
 * Test fixtures: create the organizations rows that companies, bids and users reference.
 * The database no longer invents a missing parent row, so fixtures create it explicitly.
 */
export async function ensureOrganizations(db: DrizzleDb, ...ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .insert(schema.organizations)
    .values(ids.map((id) => ({ id, name: `Test organization ${id}` })))
    .onConflictDoNothing();
}
