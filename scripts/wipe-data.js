#!/usr/bin/env node
/**
 * TenderPulse AI — Complete Data Wipe Script
 *
 * Wipes all records from the local PostgreSQL (PGlite) database across all 17 tables,
 * purges all cloud objects from the AWS S3 storage bucket, and purges cloud SQS queues.
 */
import { PGlite } from '@electric-sql/pglite';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { SQSClient, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data/postgres');

async function wipeDatabase() {
  console.log('\n🗑️  [1/3] Wiping Local PostgreSQL Database (PGlite)...');
  const pg = new PGlite(dbPath);
  await pg.waitReady;

  const tables = [
    'audit_logs',
    'bid_decisions',
    'compliance_items',
    'document_processing_outbox',
    'tender_documents',
    'bids',
    'evidence_verification_history',
    'company_evidence_documents',
    'company_profiles',
    'company_profile_versions',
    'tenant_settings',
    'companies',
    'notifications',
    'subscriptions',
    'usage_records',
    'refresh_tokens',
    'users',
  ];

  try {
    const truncateSql = `TRUNCATE TABLE ${tables.join(', ')} CASCADE;`;
    await pg.exec(truncateSql);
    console.log(`   ✅ Truncated ${tables.length} tables cleanly.`);

    // Verify row counts
    let totalRows = 0;
    for (const table of tables) {
      const res = await pg.query(`SELECT count(*) FROM ${table};`);
      const count = parseInt(res.rows[0]?.count || '0', 10);
      totalRows += count;
    }
    console.log(`   ✅ Database verification: Total records across all tables = ${totalRows}.`);
  } catch (err) {
    console.error('   ❌ Database wipe error:', err.message);
    throw err;
  } finally {
    await pg.close();
  }
}

async function wipeCloudS3() {
  console.log('\n☁️  [2/3] Wiping Cloud Storage (AWS S3 Bucket)...');
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'ap-south-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    console.log('   ℹ️  No AWS S3 credentials or bucket configured. Skipping cloud S3 wipe.');
    return;
  }

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    let continuationToken = undefined;
    let totalDeleted = 0;

    do {
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );

      const contents = listRes.Contents || [];
      if (contents.length > 0) {
        const objectsToDelete = contents.map((c) => ({ Key: c.Key }));
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objectsToDelete },
          }),
        );
        totalDeleted += contents.length;
        contents.forEach((c) => console.log(`   - Deleted S3 Object: ${c.Key}`));
      }

      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    console.log(
      `   ✅ Cloud S3 wipe complete: Deleted ${totalDeleted} objects from bucket '${bucket}'.`,
    );
  } catch (err) {
    console.error('   ❌ Cloud S3 wipe error:', err.message);
  }
}

async function wipeCloudSQS() {
  console.log('\n📬 [3/3] Purging Cloud Message Queues (AWS SQS)...');
  const region = process.env.AWS_REGION || 'ap-south-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  const dlqUrl = process.env.AWS_SQS_DLQ_URL;

  if (!accessKeyId || !secretAccessKey) {
    console.log('   ℹ️  No AWS SQS credentials configured. Skipping SQS purge.');
    return;
  }

  const sqs = new SQSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const queuesToPurge = [
    { name: 'Primary Ingestion Queue', url: queueUrl },
    { name: 'Dead-Letter Queue (DLQ)', url: dlqUrl },
  ];

  for (const q of queuesToPurge) {
    if (q.url) {
      try {
        await sqs.send(new PurgeQueueCommand({ QueueUrl: q.url }));
        console.log(`   ✅ Purged SQS Queue: ${q.name} (${q.url})`);
      } catch (err) {
        if (err.name === 'PurgeQueueInProgress') {
          console.log(`   ℹ️  SQS Queue ${q.name} purge already in progress.`);
        } else {
          console.warn(`   ⚠️  Could not purge ${q.name}:`, err.message);
        }
      }
    }
  }
}

async function main() {
  console.log('==============================================================');
  console.log('💥 TenderPulse AI — Initiating Full Data Wipe (DB + Cloud)');
  console.log('==============================================================');

  try {
    await wipeDatabase();
    await wipeCloudS3();
    await wipeCloudSQS();

    console.log('\n==============================================================');
    console.log(
      '✨ Full wipe finished successfully! Environment is ready for clean happy-path testing.',
    );
    console.log('==============================================================\n');
  } catch (err) {
    console.error('\n❌ Fatal wipe failure:', err);
    process.exit(1);
  }
}

main();
