#!/usr/bin/env node
/**
 * TenderPulse AI — Seed Demo Data Script
 *
 * Explicitly populates mock procurement demo data (users, companies, bids, documents, compliance items)
 * into PostgreSQL.
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data/postgres');

async function seed() {
  console.log('🌱 Seeding demo procurement data into PostgreSQL (PGlite)...');
  const { initDatabase } = await import(
    path.join(rootDir, 'apps/api/dist/common/database/database.provider.js')
  );
  const pg = new PGlite(dbPath);
  await pg.waitReady;

  try {
    await initDatabase(pg, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    console.log('✅ Seeding completed successfully.');
  } finally {
    await pg.close();
  }
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
