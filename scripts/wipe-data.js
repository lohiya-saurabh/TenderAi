#!/usr/bin/env node
/**
 * TenderPulse AI — Complete Data Wipe Script
 *
 * Stop the dev servers first (`npm run dev`): PGlite is single-process, and a running API
 * would keep (and re-write) the old database.
 *
 *   npm run db:wipe              # database + uploads + S3 bucket + every configured SQS queue
 *   npm run db:wipe -- --local   # database + uploads only
 *
 * The database directories are removed outright; the API recreates the current schema
 * (including the clause tables and migrations) on its next start.
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { SQSClient, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localOnly = process.argv.includes('--local');

// The API opens data/postgres relative to its working directory: the repo root under
// `npm run dev`, apps/api when started from that folder. Both are wiped.
const DB_DIRS = ['data/postgres', 'apps/api/data/postgres'];
const UPLOAD_DIRS = ['apps/api/uploads', 'uploads'];

function wipeLocal() {
  console.log('\n🗑️  [1/3] Wiping local database and uploads...');
  for (const rel of [...DB_DIRS, ...UPLOAD_DIRS]) {
    const dir = path.join(rootDir, rel);
    if (!fs.existsSync(dir)) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    if (UPLOAD_DIRS.includes(rel)) fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ Removed ${rel}`);
  }
}

function awsCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: { accessKeyId, secretAccessKey },
  };
}

async function wipeS3() {
  console.log('\n☁️  [2/3] Emptying the S3 bucket...');
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  const config = awsCredentials();
  if (!bucket || !config) {
    console.log('   ℹ️  No bucket or AWS credentials configured. Skipped.');
    return;
  }
  const s3 = new S3Client(config);
  let token;
  let total = 0;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    const objects = (page.Contents || []).map((c) => ({ Key: c.Key }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
      total += objects.length;
    }
    token = page.NextContinuationToken;
  } while (token);
  console.log(`   ✅ Deleted ${total} objects from '${bucket}'.`);
}

async function purgeSqs() {
  console.log('\n📬 [3/3] Purging SQS queues...');
  const config = awsCredentials();
  const urls = [
    ...new Set(
      [
        'AWS_SQS_QUEUE_URL',
        'AWS_SQS_INGESTION_QUEUE_URL',
        'AWS_INGESTION_QUEUE_URL',
        'AWS_SQS_DLQ_URL',
        'AWS_SQS_COMPLETION_QUEUE_URL',
        'AWS_SQS_COMPLETION_DLQ_URL',
      ]
        .map((k) => process.env[k])
        .filter(Boolean),
    ),
  ];
  if (!config || urls.length === 0) {
    console.log('   ℹ️  No queues or AWS credentials configured. Skipped.');
    return;
  }
  const sqs = new SQSClient(config);
  for (const url of urls) {
    try {
      await sqs.send(new PurgeQueueCommand({ QueueUrl: url }));
      console.log(`   ✅ Purged ${url}`);
    } catch (err) {
      const note = err.name === 'PurgeQueueInProgress' ? 'purge already in progress' : err.message;
      console.warn(`   ⚠️  ${url}: ${note}`);
    }
  }
}

async function main() {
  console.log('💥 TenderPulse AI — data wipe' + (localOnly ? ' (local only)' : ' (local + AWS)'));
  wipeLocal();
  if (!localOnly) {
    await wipeS3();
    await purgeSqs();
  }
  console.log('\n✨ Done. Start the API to recreate an empty database.\n');
}

main().catch((err) => {
  console.error('\n❌ Wipe failed:', err);
  process.exit(1);
});
