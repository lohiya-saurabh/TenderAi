import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  NotFound,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorageService,
  HeadObjectResult,
} from '@/modules/bids/application/IStorageService.js';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';

export interface AwsS3StorageConfig {
  bucketName: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class AwsS3StorageService implements IStorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new StructuredLogger('AwsS3StorageService', 'api');

  constructor(config: AwsS3StorageConfig) {
    this.bucketName = config.bucketName;
    this.s3Client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'ap-south-1',
      endpoint: config.endpoint || process.env.S3_ENDPOINT || undefined,
      forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint || process.env.S3_ENDPOINT),
      credentials:
        config.credentials ||
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined),
    });
  }

  public async generatePresignedUploadUrl(
    s3Key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    this.logger.info('storage.presigned_url.generated', 'Generated presigned upload URL', {
      objectKey: s3Key,
      contentType,
      expiresInSeconds,
      mode: 'UPLOAD',
    });

    return url;
  }

  public async generatePresignedDownloadUrl(
    s3Key: string,
    downloadFileName: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const encodedFileName = encodeURIComponent(downloadFileName);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${encodedFileName}"`,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    this.logger.info('storage.presigned_url.generated', 'Generated presigned download URL', {
      objectKey: s3Key,
      downloadFileName,
      expiresInSeconds,
      mode: 'DOWNLOAD',
    });

    return url;
  }

  public async headObject(s3Key: string): Promise<HeadObjectResult> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      return {
        exists: true,
        sizeBytes: response.ContentLength ?? 0,
        checksumSha256: response.ChecksumSHA256,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFound ||
        error instanceof NoSuchKey ||
        (typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error.name === 'NotFound' || error.name === 'NoSuchKey')) ||
        (typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
      ) {
        return { exists: false, sizeBytes: 0 };
      }
      throw error;
    }
  }

  public async getObject(s3Key: string): Promise<string | Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error: unknown) {
      if (
        error instanceof NotFound ||
        error instanceof NoSuchKey ||
        (typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error.name === 'NotFound' || error.name === 'NoSuchKey')) ||
        (typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
      ) {
        return null;
      }
      throw error;
    }
  }

  public async putObject(
    s3Key: string,
    content: Buffer,
    contentType = 'application/pdf',
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: contentType,
    });
    await this.s3Client.send(command);
    this.logger.info('storage.object.uploaded', 'Uploaded object directly to S3', {
      objectKey: s3Key,
      sizeBytes: content.length,
      contentType,
    });
  }

  public async findFilesByPrefix(prefix: string): Promise<string[]> {
    try {
      const list = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        }),
      );
      if (!list.Contents || list.Contents.length === 0) {
        return [];
      }
      return list.Contents.map((obj) => obj.Key).filter((key): key is string => Boolean(key));
    } catch (err) {
      this.logger.warn(
        'storage.find_files_by_prefix.failed',
        `Failed to list files with prefix ${prefix}`,
        { prefix, error: err },
      );
      return [];
    }
  }

  public async deleteObject(s3Key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        }),
      );
      this.logger.info('storage.delete.completed', 'Deleted object from storage', {
        objectKey: s3Key,
      });
    } catch (err) {
      this.logger.warn('storage.delete.failed', `Failed to delete object ${s3Key}`, {
        objectKey: s3Key,
        error: err,
      });
    }
  }

  public async deletePrefix(prefix: string): Promise<void> {
    try {
      const list = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        }),
      );

      if (list.Contents && list.Contents.length > 0) {
        const objects = list.Contents.filter((obj) => obj.Key).map((obj) => ({ Key: obj.Key! }));
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: { Objects: objects },
          }),
        );
        this.logger.info(
          'storage.delete_prefix.completed',
          `Deleted objects with prefix ${prefix}`,
          { prefix, count: objects.length },
        );
      }
    } catch (err) {
      this.logger.warn('storage.delete_prefix.failed', `Failed to delete prefix ${prefix}`, {
        prefix,
        error: err,
      });
    }
  }
}
