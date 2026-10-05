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
  const seedUsers = options?.seedUsers ?? true;
  const seedFullProfile = options?.seedFullProfile ?? true;
  const seedBidsAndCompliance = options?.seedBidsAndCompliance ?? true;

  // 1. Create Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions JSONB NOT NULL,
      organization_id TEXT NOT NULL,
      organization_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
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
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_items (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS company_evidence JSONB;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS risk JSONB;
    ALTER TABLE compliance_items ADD COLUMN IF NOT EXISTS rationale JSONB;

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
      organization_id TEXT NOT NULL,
      version INT NOT NULL,
      name TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_company_profile_versions_org
      ON company_profile_versions(organization_id, version DESC);

    CREATE TABLE IF NOT EXISTS company_profiles (
      organization_id TEXT PRIMARY KEY,
      active_version_id TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bid_decisions (
      id TEXT PRIMARY KEY,
      bid_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      profile_version_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      state TEXT NOT NULL,
      readiness_score REAL NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_bid_decisions_org_bid
      ON bid_decisions(organization_id, bid_id, created_at DESC);
  `);

  const drizzleDb = drizzle(db, { schema });

  // 2. Seed Users if empty
  if (seedUsers) {
    const userCountResult = await drizzleDb.select({ count: sql<string>`count(*)` }).from(schema.users);
    const userCount = parseInt(userCountResult[0]?.count || '0', 10);

    if (userCount === 0) {
      console.log('🌱 Seeding users into PostgreSQL (with bcrypt password hashes)...');
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
    } else {
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
    }
  }

  // 3. Seed Company Capability Profile (11 domains) if empty
  if (seedFullProfile) {
    const profileCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.companyProfiles);
    const profileCount = parseInt(profileCountResult[0]?.count || '0', 10);

    if (profileCount === 0) {
      console.log('🌱 Seeding Enterprise Company Capability Profile (11 domains) into PostgreSQL...');
      await drizzleDb
        .insert(schema.companyProfileVersions)
        .values({
          id: 'cpv-acme-v1',
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
          organizationId: 'org_acme_infra_001',
          activeVersionId: 'cpv-acme-v1',
          updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        })
        .onConflictDoNothing();
    }
  }

  // 4. Seed Bids & Tender Documents if empty
  if (seedBidsAndCompliance) {
    const bidCountResult = await drizzleDb.select({ count: sql<string>`count(*)` }).from(schema.bids);
    const bidCount = parseInt(bidCountResult[0]?.count || '0', 10);

    if (bidCount === 0) {
      console.log('🌱 Seeding realistic tender projects into PostgreSQL...');
      for (const bid of BIDS) {
        await drizzleDb
          .insert(schema.bids)
          .values({
            id: bid.id,
            organizationId: 'org_acme_infra_001',
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
    }

    // 5. Seed Compliance Items if empty
    const complianceCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.complianceItems);
    const complianceCount = parseInt(complianceCountResult[0]?.count || '0', 10);

    if (complianceCount === 0) {
      console.log('🌱 Seeding grounded compliance items with dual-sided provenance into PostgreSQL...');
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
  }

  console.log('✅ PostgreSQL database ready (all tables seeded with rich production data).');
}
