/**
 * Real-PostgreSQL integration suite: driver, migrations, demo seed and outbox claiming.
 *
 * Skipped unless TEST_DATABASE_URL points at a PostgreSQL server whose role may
 * CREATE DATABASE, e.g.
 *   TEST_DATABASE_URL=postgresql://localhost:5432/postgres npx vitest run src/test/postgres
 * Each run creates a throwaway database and drops it afterwards.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import { createDrizzleFor, createPostgresPool } from '@/common/database/client.js';
import { runMigrations } from '@/common/database/migrator.js';
import { MIGRATIONS } from '@/common/database/migrations/index.js';
import { initDatabase } from '@/common/database/database.provider.js';
import { DocumentsRepository } from '@/modules/documents/documents.repository.js';
import * as schema from '@/common/database/schema.js';

const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('PostgreSQL integration (node-postgres)', () => {
  const dbName = `tp_it_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let admin: pg.Client;
  let pools: pg.Pool[] = [];

  const newPool = () => {
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const pool = createPostgresPool({ connectionString: url.toString() });
    pools.push(pool);
    return pool;
  };

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
  });

  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
    pools = [];
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  it('applies all migrations once, even when two instances start together', async () => {
    const [a, b] = await Promise.all([runMigrations(newPool()), runMigrations(newPool())]);

    const appliedTotal = [...a.applied, ...b.applied].sort();
    expect(appliedTotal).toEqual(MIGRATIONS.map((m) => m.id).sort());

    const again = await runMigrations(newPool());
    expect(again.applied).toEqual([]);
    expect(again.skipped).toEqual(MIGRATIONS.map((m) => m.id));
  });

  it('refuses to run when an applied migration was edited', async () => {
    const edited = MIGRATIONS.map((m, i) => (i === 0 ? { ...m, sql: `${m.sql}\n-- edited` } : m));
    await expect(runMigrations(newPool(), edited)).rejects.toThrow(/checksum mismatch/);
  });

  it('seeds the demo data through Drizzle on node-postgres', async () => {
    const pool = newPool();
    await initDatabase(pool, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    const db = createDrizzleFor(pool);

    const bids = await db.select().from(schema.bids);
    expect(bids.length).toBeGreaterThan(0);
    expect(bids[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('lets exactly one of many concurrent pollers claim an outbox message', async () => {
    const pool = newPool();
    const db = createDrizzleFor(pool);
    const [doc] = await db.select().from(schema.tenderDocuments).limit(1);
    expect(doc).toBeDefined();

    const outboxId = `obx_it_${randomUUID()}`;
    await db.insert(schema.documentProcessingOutbox).values({
      id: outboxId,
      organizationId: doc!.organizationId,
      documentId: doc!.id,
      payload: { documentId: doc!.id },
      status: 'PENDING',
      nextAttemptAt: new Date(Date.now() - 1000),
    });

    // Separate pools, so the claims really race on different backend connections.
    const repos = Array.from(
      { length: 8 },
      () => new DocumentsRepository(createDrizzleFor(newPool())),
    );
    const now = new Date();
    const staleLease = new Date(now.getTime() - 5 * 60_000);
    const results = await Promise.all(
      repos.map((r) => r.claimOutboxMessage(outboxId, now, staleLease)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const [row] = await db
      .select()
      .from(schema.documentProcessingOutbox)
      .where(eq(schema.documentProcessingOutbox.id, outboxId));
    expect(row!.status).toBe('PUBLISHING');
  });

  it('cascades a deleted user to their notifications but keeps org-wide ones', async () => {
    const pool = newPool();
    const db = createDrizzleFor(pool);
    const [user] = await db.select().from(schema.users).limit(1);
    expect(user).toBeDefined();

    const personal = `ntf_it_personal_${randomUUID()}`;
    const broadcast = `ntf_it_broadcast_${randomUUID()}`;
    const base = {
      organizationId: user!.organizationId,
      category: 'SYSTEM',
      title: 'Integration test',
      message: 'Integration test',
    };
    await db.insert(schema.notifications).values([
      { ...base, id: personal, recipientUserId: user!.id },
      { ...base, id: broadcast, recipientUserId: null },
    ]);

    await expect(
      db.insert(schema.notifications).values({
        ...base,
        id: `ntf_it_orphan_${randomUUID()}`,
        recipientUserId: 'usr_does_not_exist',
      }),
    ).rejects.toThrow();

    await db.delete(schema.users).where(eq(schema.users.id, user!.id));
    const remaining = (await db.select().from(schema.notifications)).map((n) => n.id);
    expect(remaining).not.toContain(personal);
    expect(remaining).toContain(broadcast);
  });
});
