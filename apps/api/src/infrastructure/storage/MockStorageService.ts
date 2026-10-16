import {
  IStorageService,
  HeadObjectResult,
} from '@/modules/bids/application/IStorageService.js';

export class MockStorageService implements IStorageService {
  private readonly objects: Map<
    string,
    { sizeBytes: number; checksumSha256?: string; content?: string | Buffer }
  > = new Map();

  public async generatePresignedUploadUrl(
    s3Key: string,
    _contentType: string,
    _expiresInSeconds = 900,
  ): Promise<string> {
    return `https://mock-s3.tenderpulse.local/${s3Key}?X-Amz-Signature=mock-sig`;
  }

  public async generatePresignedDownloadUrl(
    s3Key: string,
    downloadFileName: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const encodedFileName = encodeURIComponent(downloadFileName);
    return `https://mock-s3.tenderpulse.local/${s3Key}?response-content-disposition=attachment%3B%20filename%3D%22${encodedFileName}%22&expires=${expiresInSeconds}&X-Amz-Signature=mock-get-sig`;
  }

  public async headObject(s3Key: string): Promise<HeadObjectResult> {
    const obj = this.objects.get(s3Key);
    if (!obj) {
      return { exists: false, sizeBytes: 0 };
    }
    return {
      exists: true,
      sizeBytes: obj.sizeBytes,
      checksumSha256: obj.checksumSha256,
    };
  }

  public async getObject(s3Key: string): Promise<string | Buffer | null> {
    const obj = this.objects.get(s3Key);
    if (!obj) {
      return null;
    }
    return obj.content ?? Buffer.from('Default simulated document binary content');
  }

  public async putObject(
    storagePath: string,
    content: Buffer,
    _contentType = 'application/pdf',
  ): Promise<void> {
    this.simulateUploadedObject(storagePath, content.length, undefined, content);
  }

  public simulateUploadedObject(
    s3Key: string,
    sizeBytes: number,
    checksumSha256?: string,
    content?: string | Buffer,
  ): void {
    this.objects.set(s3Key, { sizeBytes, checksumSha256, content });
  }

  public clear(): void {
    this.objects.clear();
  }

  public async findFilesByPrefix(prefix: string): Promise<string[]> {
    return Array.from(this.objects.keys()).filter((key) => key.startsWith(prefix));
  }

  public async deleteObject(s3Key: string): Promise<void> {
    this.objects.delete(s3Key);
  }

  public async deletePrefix(prefix: string): Promise<void> {
    for (const key of Array.from(this.objects.keys())) {
      if (key.startsWith(prefix)) {
        this.objects.delete(key);
      }
    }
  }
}
