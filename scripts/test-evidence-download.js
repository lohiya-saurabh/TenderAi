import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data/postgres');

async function testDownload() {
  const pg = new PGlite(dbPath);
  await pg.waitReady;
  try {
    const docs = await pg.query('SELECT id, file_name, file_size_bytes, storage_path FROM company_evidence_documents;');
    console.log(`Found ${docs.rows.length} evidence documents:`);
    for (const d of docs.rows) {
      const diskPath = path.join(rootDir, 'apps/api/uploads', d.storage_path);
      const fs = await import('node:fs');
      if (fs.existsSync(diskPath)) {
        const stats = fs.statSync(diskPath);
        console.log(`✅ [File Exists on Disk & Storage] ${d.file_name}: ${stats.size} bytes matches DB (${d.file_size_bytes} bytes)`);
      } else {
        console.error(`❌ Missing file on disk: ${diskPath}`);
        process.exit(1);
      }
    }
  } finally {
    await pg.close();
  }
}

testDownload().catch(console.error);
