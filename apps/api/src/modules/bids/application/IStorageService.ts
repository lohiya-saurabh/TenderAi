export interface HeadObjectResult {
  exists: boolean;
  sizeBytes: number;
  checksumSha256?: string;
}

export interface IStorageService {
  generatePresignedUploadUrl(
    s3Key: string,
    contentType: string,
    expiresInSeconds?: number
  ): Promise<string>;

  generatePresignedDownloadUrl(
    s3Key: string,
    downloadFileName: string,
    expiresInSeconds?: number
  ): Promise<string>;

  headObject(s3Key: string): Promise<HeadObjectResult>;

  getObject(s3Key: string): Promise<string | Buffer | null>;
}
