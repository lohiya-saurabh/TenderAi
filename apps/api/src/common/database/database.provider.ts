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
import { DEMO_USERS, BIDS } from '../../seed/data.js';
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

export async function initDatabase(db: PGlite): Promise<void> {
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
      tender_number TEXT NOT NULL,
      tendering_authority TEXT NOT NULL,
      estimated_value_rupees BIGINT NOT NULL,
      submission_deadline TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_requirements INT NOT NULL DEFAULT 0,
      flagged_requirements INT NOT NULL DEFAULT 0,
      approved_requirements INT NOT NULL DEFAULT 0,
      version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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
  `);

  // 2. Seed Users if empty via Drizzle ORM
  const drizzleDb = drizzle(db, { schema });
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

  // 3. Seed Base Bids (with 0 documents and 0 compliance items) if empty
  const bidCountResult = await drizzleDb.select({ count: sql<string>`count(*)` }).from(schema.bids);
  const bidCount = parseInt(bidCountResult[0]?.count || '0', 10);

  if (bidCount === 0) {
    console.log('🌱 Seeding initial tender projects into PostgreSQL (clean: 0 documents, 0 compliance items)...');
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
          status: 'DRAFT',
          totalRequirements: 0,
          flaggedRequirements: 0,
          approvedRequirements: 0,
          version: 1,
          createdAt: new Date(bid.createdAt),
          updatedAt: new Date(bid.updatedAt),
        })
        .onConflictDoNothing();

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

  console.log('✅ PostgreSQL database ready (clean state: 0 seed documents, 0 seed compliance items).');
}
