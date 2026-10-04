import { Storage, StorageOptions } from '@google-cloud/storage';
import { EventEmitter } from 'node:events';
import {
  IStorageService,
  HeadObjectResult,
} from '../../modules/bids/application/IStorageService.js';

// Tune stream pipeline listener headroom for GCS chunked streams
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners || 10, 30);

export interface GcsStorageConfig {
  bucketName: string;
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email?: string;
    private_key?: string;
  };
  apiEndpoint?: string;
}

export class GcsStorageService implements IStorageService {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(config: GcsStorageConfig) {
    this.bucketName = config.bucketName;

    const storageOptions: StorageOptions = {
      projectId: config.projectId || process.env.GCP_PROJECT_ID || undefined,
      keyFilename: config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
      apiEndpoint: config.apiEndpoint || process.env.GCS_ENDPOINT || undefined,
    };

    if (config.credentials) {
      storageOptions.credentials = config.credentials;
    }

    this.storage = new Storage(storageOptions);
  }

  public async generatePresignedUploadUrl(
    storagePath: string,
    contentType: string,
    expiresInSeconds = 900
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storagePath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
    });

    return url;
  }

  public async generatePresignedDownloadUrl(
    storagePath: string,
    downloadFileName: string,
    expiresInSeconds = 300
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(storagePath);
    const encodedFileName = encodeURIComponent(downloadFileName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
      responseDisposition: `attachment; filename="${encodedFileName}"`,
    });

    return url;
  }

  public async headObject(storagePath: string): Promise<HeadObjectResult> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);
      const [metadata] = await file.getMetadata();

      const sizeBytes = typeof metadata.size === 'number'
        ? metadata.size
        : typeof metadata.size === 'string'
          ? parseInt(metadata.size, 10)
          : 0;

      const customMetadata = metadata.metadata as Record<string, string> | undefined;

      return {
        exists: true,
        sizeBytes: Number.isNaN(sizeBytes) ? 0 : sizeBytes,
        checksumSha256: customMetadata?.checksumSha256,
      };
    } catch (error: unknown) {
      if (
        (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 404) ||
        (typeof error === 'object' && error !== null && 'message' in error && String((error as { message: string }).message).includes('Not Found'))
      ) {
        return { exists: false, sizeBytes: 0 };
      }
      throw error;
    }
  }

  public async getObject(storagePath: string): Promise<string | Buffer | null> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);
      const [contents] = await file.download();
      return contents;
    } catch (error: unknown) {
      if (
        (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 404) ||
        (typeof error === 'object' && error !== null && 'message' in error && String((error as { message: string }).message).includes('Not Found'))
      ) {
        return null;
      }
      throw error;
    }
  }

  public async findFilesByPrefix(prefix: string): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix });
      return files.map((f) => f.name);
    } catch {
      return [];
    }
  }

  public async deleteObject(storagePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(storagePath);
      await file.delete({ ignoreNotFound: true });
    } catch (err) {
      console.warn(`[GcsStorageService] Failed to delete object ${storagePath}:`, err);
    }
  }

  public async deletePrefix(prefix: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.deleteFiles({ prefix, force: true });
    } catch (err) {
      console.warn(`[GcsStorageService] Failed to delete prefix ${prefix}:`, err);
    }
  }
}
