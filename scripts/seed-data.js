#!/usr/bin/env node
/**
 * TenderPulse AI — Seed Demo Data Script
 *
 * Explicitly populates mock procurement demo data (users, companies, bids, documents, compliance items)
 * into PostgreSQL.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseUrl, describeDatabase } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function seed() {
  databaseUrl(); // exits with setup help when DATABASE_URL is missing
  console.log(`🌱 Seeding demo procurement data into PostgreSQL (${describeDatabase()})...`);
  const dist = path.join(rootDir, 'apps/api/dist/common/database');
  const { getDatabase, initDatabase } = await import(path.join(dist, 'database.provider.js'));
  const { closeDatabase } = await import(path.join(dist, 'client.js'));
  const db = await getDatabase();

  try {
    await initDatabase(db, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    console.log('✅ Seeding completed successfully.');
  } finally {
    await closeDatabase(db);
  }
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
