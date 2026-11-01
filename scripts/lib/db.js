/**
 * Shared PostgreSQL connection for the db:* maintenance scripts.
 * Reads DATABASE_URL (and optional DATABASE_SSL / DATABASE_SSL_CA_FILE) like the API does.
 */
import fs from 'node:fs';
import pg from 'pg';

export function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      '❌ DATABASE_URL is not set. Add it to .env, e.g.\n' +
        '   DATABASE_URL=postgresql://tenderpulse:tenderpulse_dev_password@localhost:5432/tenderpulse_db',
    );
    process.exit(1);
  }
  return url;
}

/** host/database only, never credentials, for log lines. */
export function describeDatabase(url = databaseUrl()) {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

export function isLocalDatabase(url = databaseUrl()) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname);
}

function sslConfig() {
  const mode = (process.env.DATABASE_SSL || 'disable').toLowerCase();
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') {
    const ca = process.env.DATABASE_SSL_CA_FILE;
    return { rejectUnauthorized: true, ...(ca ? { ca: fs.readFileSync(ca, 'utf-8') } : {}) };
  }
  return undefined;
}

export async function openDb() {
  const client = new pg.Client({ connectionString: databaseUrl(), ssl: sslConfig() });
  await client.connect();
  return {
    query: (text, params) => client.query(text, params),
    close: () => client.end(),
  };
}
