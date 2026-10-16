/**
 * PGlite database factory and schema initialization orchestrator.
 */
import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/common/database/schema.js';
import { initDatabaseDdl } from './ddl.js';
import { seedDatabase, type SeedDatabaseOptions } from './seed-database.js';

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

export type InitDatabaseOptions = SeedDatabaseOptions;

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

  // 1. Run DDL migrations & indexes
  await initDatabaseDdl(db);

  // 2. Initialize Drizzle & run seeds
  const drizzleDb = drizzle(db, { schema });
  await seedDatabase(drizzleDb, { seedUsers, seedFullProfile, seedBidsAndCompliance });

  console.log(
    `✅ PostgreSQL database ready (${seedUsers || seedBidsAndCompliance ? 'demo seeded' : 'clean state'}).`,
  );
}
