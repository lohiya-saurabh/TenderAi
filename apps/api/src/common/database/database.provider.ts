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
    console.warn('[Database] PGlite failed to boot from disk (dirty shutdown/WASM recovery). Recovering clean database...', err);
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
  const isDevOrTest = process.env.NODE_ENV !== 'production';
  const defaultSeed = process.env.SEED_DEMO_DATA === 'true' || (process.env.SEED_DEMO_DATA !== 'false' && isDevOrTest);
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);

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
      .where(sql`${schema.users.password} NOT LIKE '$2b$%' AND ${schema.users.password} NOT LIKE '$2a$%'`);

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
  }

  // 4. Seed Bids & Tender Documents if enabled
  if (seedBidsAndCompliance) {
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
          message: 'Clause 1.4.3 requires notarized affidavit on ₹500 Maharashtra e-Stamp paper for NHAI EPC bypass tender.',
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
          message: 'Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200) submission deadline is in 40 days (15-Nov-2026).',
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
          message: '3-Year CA Turnover Certificate (UDIN 25089745AAAAAA1234) successfully matched against NHAI financial eligibility.',
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

  console.log(`✅ PostgreSQL database ready (${seedUsers || seedBidsAndCompliance ? 'demo seeded' : 'clean state'}).`);
}
