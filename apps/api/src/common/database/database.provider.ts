/**
 * PGlite database factory and schema initialization.
 *
 * Extracted from server/db/database.ts for NestJS module consumption.
 */
import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import {
  DEMO_USERS,
  DEMO_COMPANIES,
  BIDS,
  DEMO_COMPANY_PROFILE_PAYLOAD,
  DEMO_COMPLIANCE_ITEMS,
  DEMO_BID_DECISION_SEED,
} from '../../seed/data.js';
import * as schema from './schema.js';

let dbInstance: PGlite | null = null;

export async function getDatabase(dataDir?: string): Promise<PGlite> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = dataDir || path.resolve(process.cwd(), 'data/postgres');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  // Remove stale postmaster.pid if an ungraceful shutdown occurred
  const pidFile = path.join(dbPath, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // ignore
    }
  }

  try {
    const pg = new PGlite(dbPath);
    await pg.waitReady;
    dbInstance = pg;
    return dbInstance;
  } catch (err) {
    console.warn(
      '[Database] PGlite failed to boot from disk (dirty shutdown/WASM recovery). Recovering clean database...',
      err,
    );
    try {
      fs.rmSync(dbPath, { recursive: true, force: true });
      fs.mkdirSync(dbPath, { recursive: true });
    } catch {
      // ignore
    }
    const pg = new PGlite(dbPath);
    await pg.waitReady;
    dbInstance = pg;
    return dbInstance;
  }
}

export interface InitDatabaseOptions {
  seedUsers?: boolean;
  seedFullProfile?: boolean;
  seedBidsAndCompliance?: boolean;
}

export async function initDatabase(db: PGlite, options?: InitDatabaseOptions): Promise<void> {
  let seedDemoEnv = process.env.SEED_DEMO_DATA;
  const envFilePath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envFilePath)) {
    try {
      const envContent = fs.readFileSync(envFilePath, 'utf-8');
      const match = envContent.match(/^SEED_DEMO_DATA=(.*)$/m);
      if (match) {
        seedDemoEnv = match[1]?.trim();
      }
    } catch {
      // ignore
    }
  }

  const defaultSeed = seedDemoEnv === 'true';
  const seedUsers = options?.seedUsers ?? defaultSeed;
  const seedFullProfile = options?.seedFullProfile ?? defaultSeed;
  const seedBidsAndCompliance = options?.seedBidsAndCompliance ?? defaultSeed;

  // 1. Create Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      permissions JSONB NOT NULL,
      organization_id TEXT NOT NULL,
      organization_name TEXT NOT NULL
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

    CREATE TABLE IF NOT EXISTS tenant_settings (
      id TEXT PRIMARY KEY,
      organization_id TEXT UNIQUE NOT NULL,
      default_company_id TEXT,
      notification_preferences JSONB NOT NULL DEFAULT '{"notifyDeadlines": true, "notifyEvidenceExpiry": true, "notifyReviewRequests": true, "notifyHighRiskFlags": true}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      slug TEXT,
      gstin TEXT,
      pan TEXT,
      udyam_id TEXT,
      constitution TEXT,
      gstin_verified_at TIMESTAMPTZ,
      gstin_verification_data JSONB,
      udyam_verified_at TIMESTAMPTZ,
      udyam_verification_data JSONB,
      digilocker_linked_at TIMESTAMPTZ,
      digilocker_metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE companies ADD COLUMN IF NOT EXISTS cin TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS gstin_verified_at TIMESTAMPTZ;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS gstin_verification_data JSONB;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS udyam_verified_at TIMESTAMPTZ;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS udyam_verification_data JSONB;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS mca_verified_at TIMESTAMPTZ;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS mca_verification_data JSONB;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS digilocker_linked_at TIMESTAMPTZ;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS digilocker_metadata JSONB;

    CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);

    CREATE TABLE IF NOT EXISTS company_evidence_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      mime_type TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      evidence_type TEXT NOT NULL DEFAULT 'OTHER',
      issuer TEXT,
      reference_number TEXT,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      source_provider TEXT NOT NULL DEFAULT 'LOCAL_UPLOAD',
      source_reference TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verification_status TEXT NOT NULL DEFAULT 'IMPORTED',
      verification_method TEXT,
      verified_at TIMESTAMPTZ,
      verified_by TEXT,
      discrepancy_notes TEXT,
      extracted_attributes JSONB,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS evidence_type TEXT NOT NULL DEFAULT 'OTHER';
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS issuer TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS reference_number TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS source_provider TEXT NOT NULL DEFAULT 'LOCAL_UPLOAD';
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS source_reference TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS verification_method TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS verified_by TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS extracted_attributes JSONB;
    ALTER TABLE company_evidence_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_comp_ev_docs_comp ON company_evidence_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_comp_ev_docs_org ON company_evidence_documents(organization_id);
    CREATE INDEX IF NOT EXISTS idx_comp_ev_status ON company_evidence_documents(company_id, verification_status);

    CREATE TABLE IF NOT EXISTS evidence_verification_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      evidence_document_id TEXT NOT NULL REFERENCES company_evidence_documents(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      verification_method TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      verification_payload JSONB,
      discrepancy_notes TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ev_hist_doc ON evidence_verification_history(evidence_document_id);
    CREATE INDEX IF NOT EXISTS idx_ev_hist_comp ON evidence_verification_history(company_id);

    CREATE TABLE IF NOT EXISTS company_evidence_chunks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      evidence_document_id TEXT NOT NULL REFERENCES company_evidence_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      chunk_type TEXT NOT NULL DEFAULT 'PROSE',
      content TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      clause_reference TEXT,
      bounding_box JSONB,
      metadata JSONB,
      embedding JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_comp_ev_chunks_comp ON company_evidence_chunks(organization_id, company_id);
    CREATE INDEX IF NOT EXISTS idx_comp_ev_chunks_doc ON company_evidence_chunks(evidence_document_id);

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      tender_number TEXT NOT NULL DEFAULT '',
      tendering_authority TEXT NOT NULL DEFAULT '',
      estimated_value_rupees BIGINT NOT NULL DEFAULT 0,
      submission_deadline TEXT,
      location_state TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_requirements INT NOT NULL DEFAULT 0,
      flagged_requirements INT NOT NULL DEFAULT 0,
      approved_requirements INT NOT NULL DEFAULT 0,
      version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE bids ADD COLUMN IF NOT EXISTS company_id TEXT;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS tender_number TEXT NOT NULL DEFAULT '';
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS tendering_authority TEXT NOT NULL DEFAULT '';
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS estimated_value_rupees BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS submission_deadline TEXT;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS location_state TEXT;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS total_requirements INT NOT NULL DEFAULT 0;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS flagged_requirements INT NOT NULL DEFAULT 0;
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS approved_requirements INT NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_bids_org ON bids(organization_id);

    CREATE TABLE IF NOT EXISTS tender_documents (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      mime_type TEXT NOT NULL,
      document_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UPLOADED',
      processing_attempts INT NOT NULL DEFAULT 0,
      processing_started_at TIMESTAMPTZ,
      processing_completed_at TIMESTAMPTZ,
      last_processing_error TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS processing_attempts INT NOT NULL DEFAULT 0;
    ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
    ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;
    ALTER TABLE tender_documents ADD COLUMN IF NOT EXISTS last_processing_error TEXT;

    CREATE INDEX IF NOT EXISTS idx_tender_documents_bid_org ON tender_documents(bid_id, organization_id);

    CREATE TABLE IF NOT EXISTS compliance_items (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL,
      company_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
      review_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      version INT NOT NULL DEFAULT 1,
      execution_rules JSONB NOT NULL,
      provenance JSONB NOT NULL,
      company_evidence JSONB,
      risk JSONB,
      rationale JSONB,
      workflow_run_id TEXT,
      correlation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS company_evidence JSONB;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS risk JSONB;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS rationale JSONB;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS workflow_run_id TEXT;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS correlation_id TEXT;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS company_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_compliance_items_bid_org ON compliance_items(bid_id, organization_id);

    CREATE TABLE IF NOT EXISTS document_processing_outbox (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    );

    ALTER TABLE document_processing_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_document_processing_outbox_pending
      ON document_processing_outbox(status, next_attempt_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_profile_versions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      version INT NOT NULL,
      name TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_profile_versions ADD COLUMN IF NOT EXISTS company_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_company_profile_versions_org
      ON company_profile_versions(organization_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_company_profile_versions_comp
      ON company_profile_versions(company_id, version DESC);

    CREATE TABLE IF NOT EXISTS company_profiles (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      active_version_id TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS id TEXT;
    ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS company_id TEXT;

    CREATE TABLE IF NOT EXISTS bid_decisions (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL,
      company_id TEXT,
      organization_id TEXT NOT NULL,
      profile_version_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      state TEXT NOT NULL,
      readiness_score REAL NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE bid_decisions ADD COLUMN IF NOT EXISTS company_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_bid_decisions_bid ON bid_decisions(bid_id, organization_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      recipient_user_id TEXT,
      recipient_email TEXT,
      category TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'IN_APP',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_tenant
      ON notifications(organization_id, recipient_user_id, is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT UNIQUE NOT NULL,
      plan_tier TEXT NOT NULL DEFAULT 'FREE',
      billing_interval TEXT NOT NULL DEFAULT 'MONTHLY',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMPTZ NOT NULL,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      metric TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      period_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_period
      ON usage_records(organization_id, metric, period_key);

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      revoked_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    UPDATE bid_decisions
    SET readiness_score = readiness_score / 100
    WHERE readiness_score > 1;

    UPDATE bid_decisions
    SET verdict = 'CONDITIONAL_GO'
    WHERE verdict = 'PROCEED_WITH_CAUTION';
  `);

  const drizzleDb = drizzle(db, { schema });

  // 2. Seed Users & Companies
  if (seedUsers) {
    for (const user of DEMO_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await drizzleDb
        .insert(schema.users)
        .values({
          id: user.id,
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
        })
        .onConflictDoNothing();
    }

    // Migration: ensure any existing users with plaintext passwords are upgraded to bcrypt hashes
    const unhashedUsers = await drizzleDb
      .select({ id: schema.users.id, password: schema.users.password })
      .from(schema.users)
      .where(
        sql`${schema.users.password} NOT LIKE '$2b$%' AND ${schema.users.password} NOT LIKE '$2a$%'`,
      );

    for (const u of unhashedUsers) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await drizzleDb
        .update(schema.users)
        .set({ password: hashedPassword })
        .where(eq(schema.users.id, u.id));
    }

    // Seed Companies
    for (const comp of DEMO_COMPANIES) {
      await drizzleDb
        .insert(schema.companies)
        .values({
          id: comp.id,
          organizationId: comp.organizationId,
          legalName: comp.legalName,
          slug: comp.slug ?? null,
          gstin: comp.gstin ?? null,
          pan: comp.pan ?? null,
          udyamId: comp.udyamId ?? null,
          constitution: comp.constitution ?? null,
          createdAt: new Date(comp.createdAt),
          updatedAt: new Date(comp.updatedAt),
        })
        .onConflictDoNothing();
    }
  }

  // 3. Seed Company Capability Profile (11 domains)
  if (seedFullProfile) {
    await drizzleDb
      .insert(schema.companyProfileVersions)
      .values({
        id: 'cpv-acme-v1',
        companyId: 'comp_acme_infra_001',
        organizationId: 'org_acme_infra_001',
        version: 1,
        name: 'V1.0 (Active Baseline)',
        payload: DEMO_COMPANY_PROFILE_PAYLOAD,
        createdBy: 'usr_bid_mgr_01',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      })
      .onConflictDoNothing();

    await drizzleDb
      .insert(schema.companyProfiles)
      .values({
        id: 'prof_comp_acme_infra_001',
        companyId: 'comp_acme_infra_001',
        organizationId: 'org_acme_infra_001',
        activeVersionId: 'cpv-acme-v1',
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      })
      .onConflictDoNothing();

    // 3b. Seed Company Evidence Documents & Chunks for Acme Infrastructure
    await drizzleDb
      .insert(schema.companyEvidenceDocuments)
      .values([
        {
          id: 'doc-ev-ca-audited-fy25',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'Audited_Balance_Sheet_and_CA_Certificate_FY25.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-ca-audited-fy25.pdf',
          fileSizeBytes: 2450000,
          mimeType: 'application/pdf',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          evidenceType: 'AUDITED_BALANCE_SHEET',
          issuer: 'K. S. Rao & Associates, Chartered Accountants',
          referenceNumber: 'UDIN-25089745AAAAAA1234',
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
        {
          id: 'doc-ev-completion-nhai-strr',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'NHAI_STRR_Package_3_Completion_Certificate.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-completion-nhai-strr.pdf',
          fileSizeBytes: 3120000,
          mimeType: 'application/pdf',
          sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
          evidenceType: 'COMPLETION_CERT',
          issuer: 'National Highways Authority of India',
          referenceNumber: 'NHAI/STRR/PKG-3/COMP/2023/89',
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
        {
          id: 'doc-ev-cert-iso-9001',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'ISO_9001_2015_Quality_Management_Certificate.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-cert-iso-9001.pdf',
          fileSizeBytes: 1850000,
          mimeType: 'application/pdf',
          sha256Hash: 'f4e3d2c1b0a987654321fedcba0987654321fedcba0987654321fedcba098765',
          evidenceType: 'ISO_CERT',
          issuer: 'Bureau Veritas Certification India',
          referenceNumber: 'BVC-IND-2023-0941',
          validFrom: new Date('2023-01-15T00:00:00.000Z'),
          validTo: new Date('2026-12-31T00:00:00.000Z'),
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
      ])
      .onConflictDoNothing();

    await drizzleDb
      .insert(schema.companyEvidenceChunks)
      .values([
        {
          id: 'chk-ev-ca-fy25-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-ca-audited-fy25',
          chunkIndex: 1,
          chunkType: 'CERTIFICATE_KEY_VALUE',
          content: 'Statutory Annual Financial Turnover: M/s Acme Infrastructure Solutions Ltd has achieved an Annual Financial Turnover of INR 320.50 Crores for the Financial Year 2024-25. 3-Year Average Annual Financial Turnover is INR 281.90 Crores. Certified by Statutory Auditor K. S. Rao & Associates, Chartered Accountants under UDIN 25089745AAAAAA1234.',
          pageNumber: 2,
          clauseReference: 'Financial Statement Clause 2.1',
          metadata: {
            financial_year: '2024-2025',
            turnover_inr_crores: 320.5,
            avg_turnover_inr_crores: 281.9,
            ca_udin: '25089745AAAAAA1234',
            is_audited: true,
            file_name: 'Audited_Balance_Sheet_and_CA_Certificate_FY25.pdf',
          },
        },
        {
          id: 'chk-ev-completion-nhai-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-completion-nhai-strr',
          chunkIndex: 1,
          chunkType: 'PROSE',
          content: 'Work Completion Certificate: This is to certify that Acme Infrastructure Solutions Ltd has successfully completed the Satellite Town Ring Road (STRR) Package-3 Construction project for National Highways Authority of India (NHAI) with final contract value of INR 215.00 Crores. Work completed on 20-Nov-2023.',
          pageNumber: 1,
          clauseReference: 'Completion Schedule Para 3',
          metadata: {
            client_name: 'NHAI',
            contract_value_inr_crores: 215.0,
            completion_date: '2023-11-20',
            file_name: 'NHAI_STRR_Package_3_Completion_Certificate.pdf',
          },
        },
        {
          id: 'chk-ev-iso-9001-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-cert-iso-9001',
          chunkIndex: 1,
          chunkType: 'CERTIFICATE_KEY_VALUE',
          content: 'Quality Management System Certificate ISO 9001:2015: Certified that Acme Infrastructure Solutions Ltd operates a Quality Management System complying with ISO 9001:2015 for Civil Infrastructure, Highways, and Bridges. Certificate BVC-IND-2023-0941, valid until 31-Dec-2026.',
          pageNumber: 1,
          clauseReference: 'Certificate Schedule',
          metadata: {
            standard_name: 'ISO 9001:2015',
            issuing_body: 'Bureau Veritas Certification India',
            valid_to: '2026-12-31',
            file_name: 'ISO_9001_2015_Quality_Management_Certificate.pdf',
          },
        },
      ])
      .onConflictDoNothing();
  }

  // 4. Seed Bids & Tender Documents if enabled (only on fresh database)
  if (seedBidsAndCompliance) {
    const existingBidsCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.bids);
    const existingBidsCount = parseInt(existingBidsCountResult[0]?.count || '0', 10);

    if (existingBidsCount === 0) {
      for (const bid of BIDS) {
        await drizzleDb
          .insert(schema.bids)
          .values({
            id: bid.id,
            organizationId: 'org_acme_infra_001',
            companyId: bid.companyId || 'comp_acme_infra_001',
            title: bid.title,
            tenderNumber: bid.tenderNumber,
            tenderingAuthority: bid.tenderingAuthority,
            estimatedValueRupees: bid.estimatedValueRupees,
            submissionDeadline: bid.submissionDeadline,
            locationState: bid.locationState || null,
            status: bid.status,
            totalRequirements: bid.totalRequirements,
            flaggedRequirements: bid.flaggedRequirements,
            approvedRequirements: bid.approvedRequirements,
            version: 1,
            createdAt: new Date(bid.createdAt),
            updatedAt: new Date(bid.updatedAt),
          })
          .onConflictDoNothing();

        // Seed documents for this bid
        if (bid.documents && bid.documents.length > 0) {
          for (const doc of bid.documents) {
            await drizzleDb
              .insert(schema.tenderDocuments)
              .values({
                id: doc.id,
                bidId: bid.id,
                organizationId: 'org_acme_infra_001',
                fileName: doc.fileName,
                storagePath: `bids/${bid.id}/${doc.id}-${doc.fileName}`,
                fileSizeBytes: doc.fileSizeBytes,
                mimeType: doc.mimeType,
                documentType: doc.documentType,
                status: doc.status,
                uploadedAt: new Date(doc.uploadedAt),
              })
              .onConflictDoNothing();
          }
        }

        await drizzleDb
          .insert(schema.auditLogs)
          .values({
            id: `aud-init-${bid.id}`,
            bidId: bid.id,
            organizationId: 'org_acme_infra_001',
            userId: 'usr_bid_mgr_01',
            userName: 'Vikramaditya Sharma',
            eventType: 'BID_PROJECT_CREATED',
            aggregateType: 'BidProject',
            aggregateId: bid.id,
            payload: { title: bid.title, tenderNumber: bid.tenderNumber },
            timestamp: new Date(bid.createdAt),
          })
          .onConflictDoNothing();
      }

      // 5. Seed Compliance Items if enabled
      for (const item of DEMO_COMPLIANCE_ITEMS) {
        await drizzleDb
          .insert(schema.complianceItems)
          .values({
            id: item.id,
            bidId: item.bidId,
            organizationId: 'org_acme_infra_001',
            category: item.category,
            title: item.title,
            description: item.description,
            status: item.status,
            humanReviewRequired: item.humanReviewRequired,
            reviewNotes: item.reviewNotes,
            reviewedBy: item.reviewedBy,
            reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
            version: item.version,
            executionRules: item.executionRules,
            provenance: item.provenance,
            companyEvidence: item.companyEvidence ?? null,
            risk: item.risk ?? null,
            rationale: item.rationale ?? null,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })
          .onConflictDoNothing();
      }
    }

    // 6. Seed Persisted Bid Decision if empty
    const decisionCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.bidDecisions);
    const decisionCount = parseInt(decisionCountResult[0]?.count || '0', 10);

    if (decisionCount === 0) {
      console.log('🌱 Seeding persisted deterministic bid decision into PostgreSQL...');
      await drizzleDb
        .insert(schema.bidDecisions)
        .values({
          id: DEMO_BID_DECISION_SEED.id,
          bidId: DEMO_BID_DECISION_SEED.bidId,
          organizationId: DEMO_BID_DECISION_SEED.organizationId,
          profileVersionId: DEMO_BID_DECISION_SEED.profileVersionId,
          verdict: DEMO_BID_DECISION_SEED.verdict,
          state: DEMO_BID_DECISION_SEED.state,
          readinessScore: DEMO_BID_DECISION_SEED.readinessScore,
          response: DEMO_BID_DECISION_SEED.response,
          createdAt: new Date(DEMO_BID_DECISION_SEED.createdAt),
        })
        .onConflictDoNothing();
    }

    // 7. Seed Notifications if empty
    const notificationCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.notifications);
    const notificationCount = parseInt(notificationCountResult[0]?.count || '0', 10);

    if (notificationCount === 0) {
      console.log('🌱 Seeding realistic procurement notifications into PostgreSQL...');
      const demoNotifications = [
        {
          id: 'notif-001',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'REVIEW_REQUEST',
          channel: 'IN_APP',
          priority: 'HIGH',
          title: 'Human Review Required: Non-Blacklisting Affidavit',
          message:
            'Clause 1.4.3 requires notarized affidavit on ₹500 Maharashtra e-Stamp paper for NHAI EPC bypass tender.',
          metadata: { bidId: 'bid-nhai-44-001', complianceItemId: 'comp-nhai-003' },
          isRead: false,
          createdAt: new Date('2026-10-02T10:15:00.000Z'),
        },
        {
          id: 'notif-002',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'DEADLINE',
          channel: 'IN_APP',
          priority: 'MEDIUM',
          title: 'Tender Submission Deadline Reminder',
          message:
            'Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200) submission deadline is in 40 days (15-Nov-2026).',
          metadata: { bidId: 'bid-nhai-44-001', deadline: '2026-11-15T15:00:00.000Z' },
          isRead: false,
          createdAt: new Date('2026-10-03T09:00:00.000Z'),
        },
        {
          id: 'notif-003',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'EVIDENCE_EXPIRY',
          channel: 'IN_APP',
          priority: 'LOW',
          title: 'CA Turnover Certificate Verified',
          message:
            '3-Year CA Turnover Certificate (UDIN 25089745AAAAAA1234) successfully matched against NHAI financial eligibility.',
          metadata: { companyId: 'comp_acme_infra_001', udin: '25089745AAAAAA1234' },
          isRead: true,
          createdAt: new Date('2026-10-01T11:00:00.000Z'),
        },
      ];

      for (const n of demoNotifications) {
        await drizzleDb.insert(schema.notifications).values(n).onConflictDoNothing();
      }
    }

    // 8. Seed Subscriptions if empty
    const subCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.subscriptions);
    const subCount = parseInt(subCountResult[0]?.count || '0', 10);

    if (subCount === 0) {
      console.log('🌱 Seeding tenant subscriptions into PostgreSQL...');
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await drizzleDb
        .insert(schema.subscriptions)
        .values([
          {
            id: 'sub_acme_growth_001',
            organizationId: 'org_acme_infra_001',
            planTier: 'GROWTH',
            billingInterval: 'MONTHLY',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
          {
            id: 'sub_bharat_starter_002',
            organizationId: 'org_bharat_build_002',
            planTier: 'STARTER',
            billingInterval: 'MONTHLY',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        ])
        .onConflictDoNothing();
    }
  }

  console.log(
    `✅ PostgreSQL database ready (${seedUsers || seedBidsAndCompliance ? 'demo seeded' : 'clean state'}).`,
  );
}
