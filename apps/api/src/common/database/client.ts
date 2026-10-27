/**
 * Database clients: node-postgres (real PostgreSQL, the runtime default) and PGlite
 * (in-memory/embedded PostgreSQL, used only by tests via PGLITE_DATA_DIR).
 *
 * Both speak the same SQL dialect, so the Drizzle schema, migrations and every
 * repository run unchanged on either. Code that needs raw SQL goes through SqlClient.
 */
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import * as schema from '@/common/database/schema.js';

/** Driver-neutral Drizzle handle: the query builder API both drivers share. */
export type DrizzleDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The raw database handle the app runs on. */
export type DatabaseClient = pg.Pool | PGlite;

/** Minimal raw-SQL surface used by migrations and maintenance scripts. */
export interface SqlSession {
  exec(sql: string): Promise<void>;
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export function isPglite(client: DatabaseClient): client is PGlite {
  return client instanceof PGlite;
}

export function createDrizzleFor(client: DatabaseClient): DrizzleDb {
  return isPglite(client)
    ? (drizzlePglite(client, { schema }) as unknown as DrizzleDb)
    : (drizzleNodePg(client, { schema }) as unknown as DrizzleDb);
}

/**
 * Runs fn on a single session. node-postgres needs one dedicated connection so
 * session-scoped state (advisory locks, transactions) stays on the same backend.
 */
export async function withSession<T>(
  client: DatabaseClient,
  fn: (session: SqlSession) => Promise<T>,
): Promise<T> {
  if (isPglite(client)) {
    return fn({
      exec: async (sql) => {
        await client.exec(sql);
      },
      query: async <R extends Record<string, unknown>>(sql: string, params?: unknown[]) =>
        (await client.query<R>(sql, params)).rows,
    });
  }
  const conn = await client.connect();
  try {
    return await fn({
      exec: async (sql) => {
        await conn.query(sql);
      },
      query: async <R extends Record<string, unknown>>(sql: string, params?: unknown[]) =>
        (await conn.query<R>(sql, params)).rows,
    });
  } finally {
    conn.release();
  }
}

export interface PostgresPoolOptions {
  connectionString: string;
  /** "disable" (default for local), "require" (encrypted, unverified) or "verify-full". */
  sslMode?: string;
  /** CA bundle for verify-full (e.g. the AWS RDS global bundle). */
  sslCaFile?: string;
  maxConnections?: number;
}

export function createPostgresPool(options: PostgresPoolOptions): pg.Pool {
  const mode = (options.sslMode ?? 'disable').toLowerCase();
  let ssl: pg.PoolConfig['ssl'];
  if (mode === 'require') {
    ssl = { rejectUnauthorized: false };
  } else if (mode === 'verify-full') {
    ssl = {
      rejectUnauthorized: true,
      ...(options.sslCaFile ? { ca: fs.readFileSync(options.sslCaFile, 'utf-8') } : {}),
    };
  } else if (mode !== 'disable') {
    throw new Error(`DATABASE_SSL must be disable, require or verify-full (got "${mode}").`);
  }
  return new pg.Pool({
    connectionString: options.connectionString,
    ssl,
    max: options.maxConnections ?? 10,
  });
}

export async function closeDatabase(client: DatabaseClient): Promise<void> {
  if (isPglite(client)) {
    await client.close();
  } else {
    await client.end();
  }
}
