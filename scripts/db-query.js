#!/usr/bin/env node
/**
 * TenderPulse AI — Custom SQL Query CLI
 *
 * Runs arbitrary SQL queries against the active local database and prints formatted tabular results.
 * Usage:
 *   node scripts/db-query.js "SELECT id, title, status FROM bids"
 *   npm run db:query "SELECT count(*) FROM compliance_items"
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data/postgres');

const query = process.argv.slice(2).join(' ').trim();

if (!query) {
  console.log(`
Usage:
  node scripts/db-query.js "<SQL_QUERY>"
  npm run db:query "<SQL_QUERY>"

Examples:
  node scripts/db-query.js "SELECT id, title, status FROM bids;"
  node scripts/db-query.js "SELECT title, category, status FROM compliance_items WHERE status = 'FLAGGED';"
  node scripts/db-query.js "SELECT id, file_name, status, file_size_bytes FROM tender_documents;"
`);
  process.exit(0);
}

async function runQuery() {
  const pg = new PGlite(dbPath);
  await pg.waitReady;

  try {
    const res = await pg.query(query);
    console.log(`\n🔍 Executing: ${query}\n`);
    if (res.rows.length === 0) {
      console.log('Result: 0 rows returned.');
    } else {
      console.table(res.rows);
      console.log(`(${res.rows.length} row${res.rows.length === 1 ? '' : 's'})\n`);
    }
  } catch (err) {
    console.error('❌ SQL Execution Error:', err.message);
    process.exit(1);
  } finally {
    await pg.close();
  }
}

runQuery();
