#!/usr/bin/env node
/**
 * TenderPulse AI — Database Status Inspector
 *
 * Inspects all 17 tables, counts active rows, and outputs detailed summaries
 * for Users, Organizations, Companies, Bids, Documents, and Compliance Items.
 */
import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data/postgres');

async function inspectDatabase() {
  const pg = new PGlite(dbPath);
  await pg.waitReady;

  const tables = [
    'users',
    'companies',
    'bids',
    'tender_documents',
    'compliance_items',
    'bid_decisions',
    'company_profiles',
    'company_profile_versions',
    'company_evidence_documents',
    'evidence_verification_history',
    'document_processing_outbox',
    'audit_logs',
    'tenant_settings',
    'notifications',
    'subscriptions',
    'usage_records',
    'refresh_tokens',
  ];

  console.log('\n📊 ================== TENDERPULSE DATABASE AUDIT ==================');
  console.log(`📍 Storage Path: ${dbPath}\n`);

  // 1. Table Counts
  const tableStats = [];
  let totalRows = 0;

  for (const table of tables) {
    try {
      const res = await pg.query(`SELECT count(*) FROM ${table};`);
      const count = parseInt(res.rows[0]?.count || '0', 10);
      tableStats.push({ Table: table, Rows: count });
      totalRows += count;
    } catch {
      tableStats.push({ Table: table, Rows: 'ERROR / MISSING' });
    }
  }

  console.table(tableStats);
  console.log(`Total Records: ${totalRows}\n`);

  // 2. Active Users & Tenants
  const users = await pg.query('SELECT id, email, name, role, organization_id, organization_name FROM users;');
  if (users.rows.length > 0) {
    console.log('👤 USERS & WORKSPACES:');
    console.table(users.rows);
  }

  // 3. Registered Companies
  const companies = await pg.query(
    'SELECT id, legal_name, organization_id, gstin, cin, udyam_id, gstin_verified_at, mca_verified_at, udyam_verified_at FROM companies;'
  );
  if (companies.rows.length > 0) {
    console.log('🏢 COMPANIES:');
    console.table(companies.rows);
  }

  // 4. Bids
  const bids = await pg.query(
    'SELECT id, title, tender_number, tendering_authority, status, total_requirements, flagged_requirements, created_at FROM bids ORDER BY created_at DESC;'
  );
  if (bids.rows.length > 0) {
    console.log('📑 BIDS:');
    console.table(
      bids.rows.map((b) => ({
        id: b.id,
        title: (b.title || '').slice(0, 38) + (b.title?.length > 38 ? '...' : ''),
        tender_number: b.tender_number,
        authority: (b.tendering_authority || '').slice(0, 20),
        status: b.status,
        reqs: b.total_requirements,
        flagged: b.flagged_requirements,
        created: b.created_at,
      }))
    );
  }

  // 5. Uploaded Documents
  const docs = await pg.query(
    'SELECT id, file_name, file_size_bytes, status, bid_id, uploaded_at FROM tender_documents ORDER BY uploaded_at DESC;'
  );
  if (docs.rows.length > 0) {
    console.log('📁 TENDER DOCUMENTS:');
    console.table(docs.rows);
  }

  // 6. Compliance Items
  const compliance = await pg.query(
    'SELECT id, title, category, status, human_review_required, bid_id FROM compliance_items LIMIT 10;'
  );
  if (compliance.rows.length > 0) {
    const totalComp = await pg.query('SELECT count(*) FROM compliance_items;');
    console.log(`📋 EXTRACTED COMPLIANCE CLAUSES (Showing 10 of ${totalComp.rows[0]?.count}):`);
    console.table(
      compliance.rows.map((c) => ({
        id: c.id,
        title: (c.title || '').slice(0, 40) + '...',
        category: c.category,
        status: c.status,
        reviewReq: c.human_review_required,
        bid_id: c.bid_id,
      }))
    );
  }

  // 7. Bid Decisions
  const decisions = await pg.query(
    'SELECT id, bid_id, verdict, state, readiness_score, created_at FROM bid_decisions;'
  );
  if (decisions.rows.length > 0) {
    console.log('⚖️ BID GO / NO-GO DECISIONS:');
    console.table(decisions.rows);
  }

  // 8. Evidence Documents
  const evidence = await pg.query(
    'SELECT id, file_name, evidence_type, verification_status, issuer FROM company_evidence_documents LIMIT 5;'
  );
  if (evidence.rows.length > 0) {
    console.log('📜 COMPANY EVIDENCE VAULT (Sample):');
    console.table(evidence.rows);
  }

  console.log('===================================================================\n');
  await pg.close();
}

inspectDatabase().catch((err) => {
  console.error('Failed to inspect database:', err);
  process.exit(1);
});
