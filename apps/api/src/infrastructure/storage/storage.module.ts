/**
 * StorageModule — Provides GcsStorageService as an injectable.
 *
 * Resolves GCS configuration from environment and provides it globally.
 */
import { Module, Global } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { GcsStorageService } from './GcsStorageService.js';

export const STORAGE_TOKEN = 'STORAGE_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_TOKEN,
      useFactory: (): GcsStorageService | null => {
        const keyPath = path.resolve(process.cwd(), 'gcp-key.json');
        const bucketName =
          process.env.STORAGE_BUCKET_NAME ||
          process.env.GCS_BUCKET_NAME ||
          'tenderpulse-vault-local-e004630c';

        if (!bucketName) return null;

        try {
          if (fs.existsSync(keyPath)) {
            const service = new GcsStorageService({
              bucketName,
              keyFilename: keyPath,
              projectId: process.env.GCP_PROJECT_ID || 'digital-proton-228114',
            });
            console.log(`[Storage] Connected to Google Cloud Storage bucket: gs://${bucketName}`);
            return service;
          } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            const service = new GcsStorageService({
              bucketName,
              keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
              projectId: process.env.GCP_PROJECT_ID,
            });
            console.log(`[Storage] Connected to Google Cloud Storage bucket: gs://${bucketName}`);
            return service;
          }
        } catch (e) {
          console.warn('[Storage] GCS initialization failed, falling back to local mock:', e);
        }

        return null;
      },
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
