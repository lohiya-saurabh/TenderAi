import { Module, Global, Logger } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import type { IStorageService } from '../../modules/bids/application/IStorageService.js';
import { GcsStorageService } from './GcsStorageService.js';
import { AwsS3StorageService } from './AwsS3StorageService.js';
import { MockStorageService } from './MockStorageService.js';

export const STORAGE_TOKEN = 'STORAGE_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_TOKEN,
      useFactory: (): IStorageService => {
        const logger = new Logger('StorageModule');
        // 1. AWS S3 detection
        const s3Bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
        if (s3Bucket) {
          try {
            const service = new AwsS3StorageService({
              bucketName: s3Bucket,
              region: process.env.AWS_REGION || 'ap-south-1',
              endpoint: process.env.S3_ENDPOINT,
            });
            logger.log(`Connected to AWS S3 bucket: s3://${s3Bucket}`);
            return service;
          } catch (e) {
            logger.warn(
              `AWS S3 initialization failed, falling back to local mock: ${e instanceof Error ? e.message : e}`,
            );
          }
        }

        // 2. Google Cloud Storage detection
        const keyPath = path.resolve(process.cwd(), 'gcp-key.json');
        const gcsBucket = process.env.STORAGE_BUCKET_NAME || process.env.GCS_BUCKET_NAME;

        if (gcsBucket) {
          try {
            if (fs.existsSync(keyPath)) {
              const service = new GcsStorageService({
                bucketName: gcsBucket,
                keyFilename: keyPath,
                projectId: process.env.GCP_PROJECT_ID || 'digital-proton-228114',
              });
              logger.log(`Connected to Google Cloud Storage bucket: gs://${gcsBucket}`);
              return service;
            } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
              const service = new GcsStorageService({
                bucketName: gcsBucket,
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                projectId: process.env.GCP_PROJECT_ID,
              });
              logger.log(`Connected to Google Cloud Storage bucket: gs://${gcsBucket}`);
              return service;
            }
          } catch (e) {
            logger.warn(
              `GCS initialization failed, falling back to local mock: ${e instanceof Error ? e.message : e}`,
            );
          }
        }

        // 3. Fallback to in-memory MockStorageService
        return new MockStorageService();
      },
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
