import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'node:path';
import type { IStorageService } from '@/modules/bids/application/IStorageService.js';
import { GcsStorageService } from '@/infrastructure/storage/GcsStorageService.js';
import { AwsS3StorageService } from '@/infrastructure/storage/AwsS3StorageService.js';
import { MockStorageService } from '@/infrastructure/storage/MockStorageService.js';

export const STORAGE_TOKEN = 'STORAGE_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_TOKEN,
      useFactory: (configService: ConfigService): IStorageService => {
        const logger = new Logger('StorageModule');
        const storageProvider = configService.get<string>('STORAGE_PROVIDER');
        const allowMock = configService.get<string>('ALLOW_MOCK_SERVICES');
        if (storageProvider === 'mock' || allowMock === 'true') {
          return new MockStorageService();
        }

        // 1. AWS S3 detection
        const s3Bucket =
          configService.get<string>('AWS_S3_BUCKET') ||
          configService.get<string>('S3_BUCKET_NAME');
        if (s3Bucket) {
          try {
            const service = new AwsS3StorageService({
              bucketName: s3Bucket,
              region: configService.get<string>('AWS_REGION') || 'ap-south-1',
              endpoint: configService.get<string>('S3_ENDPOINT'),
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
        const gcsBucket =
          configService.get<string>('STORAGE_BUCKET_NAME') ||
          configService.get<string>('GCS_BUCKET_NAME');

        if (gcsBucket) {
          try {
            const gcpProjectId = configService.get<string>('GCP_PROJECT_ID');
            const googleCreds = configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
            if (fs.existsSync(keyPath)) {
              const service = new GcsStorageService({
                bucketName: gcsBucket,
                keyFilename: keyPath,
                projectId: gcpProjectId,
              });
              logger.log(`Connected to Google Cloud Storage bucket: gs://${gcsBucket}`);
              return service;
            } else if (googleCreds) {
              const service = new GcsStorageService({
                bucketName: gcsBucket,
                keyFilename: googleCreds,
                projectId: gcpProjectId,
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
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
