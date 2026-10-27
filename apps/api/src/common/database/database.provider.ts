/**
 * Database factory and schema initialization orchestrator.
 *
 * Selection (first match wins):
 *   1. PGLITE_DATA_DIR (or an explicit dataDir) → PGlite. Tests set memory:// so each
 *      run gets a throwaway in-memory database.
 *   2. DATABASE_URL → real PostgreSQL through a node-postgres pool.
 *   3. Neither → startup fails with setup instructions.
 */
import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ConfigService } from '@nestjs/config';
import {
  createDrizzleFor,
  createPostgresPool,
  isPglite,
  type DatabaseClient,
} from '@/common/database/client.js';
import { runMigrations } from '@/common/database/migrator.js';
import { seedDatabase, type SeedDatabaseOptions } from './seed-database.js';

let dbInstance: DatabaseClient | null = null;

async function openPglite(dbPath: string): Promise<PGlite> {
  if (!dbPath.startsWith('memory://') && !fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  const pg = new PGlite(dbPath);
  await pg.waitReady;
  return pg;
}

export async function getDatabase(
  configOrDataDir?: ConfigService | string,
): Promise<DatabaseClient> {
  if (dbInstance) {
    return dbInstance;
  }
  const config = typeof configOrDataDir === 'string' ? undefined : configOrDataDir;
  const dataDir = typeof configOrDataDir === 'string' ? configOrDataDir : undefined;
  const env = (key: string) => config?.get<string>(key) ?? process.env[key];

  const pgliteDir = dataDir ?? env('PGLITE_DATA_DIR');
  if (pgliteDir) {
    dbInstance = await openPglite(pgliteDir);
    return dbInstance;
  }

  const databaseUrl = env('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. The API needs a PostgreSQL 16 database, e.g. ' +
        'postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/tenderpulse_db ' +
        '(see CONTRIBUTING.md "Local database").',
    );
  }
  const maxConnections = Number(env('DATABASE_POOL_MAX')) || undefined;
  dbInstance = createPostgresPool({
    connectionString: databaseUrl,
    sslMode: env('DATABASE_SSL'),
    sslCaFile: env('DATABASE_SSL_CA_FILE'),
    maxConnections,
  });
  // Fail fast on bad credentials/host instead of on the first request.
  await dbInstance.query('SELECT 1');
  return dbInstance;
}

export type InitDatabaseOptions = SeedDatabaseOptions;

export async function initDatabase(
  db: DatabaseClient,
  options?: InitDatabaseOptions,
  configService?: ConfigService,
): Promise<void> {
  const config = configService ?? new ConfigService();
  let seedDemoEnv = config.get<string>('SEED_DEMO_DATA');
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

  // 1. Apply versioned schema migrations
  const migrations = await runMigrations(db);

  // 2. Initialize Drizzle & run seeds
  await seedDatabase(createDrizzleFor(db), { seedUsers, seedFullProfile, seedBidsAndCompliance });

  console.log(
    `✅ PostgreSQL database ready (${isPglite(db) ? 'PGlite' : 'node-postgres'}; ` +
      `${migrations.applied.length} migration(s) applied; ` +
      `${seedUsers || seedBidsAndCompliance ? 'demo seeded' : 'clean state'}).`,
  );
}
