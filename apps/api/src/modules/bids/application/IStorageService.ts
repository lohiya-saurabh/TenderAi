export interface HeadObjectResult {
  exists: boolean;
  sizeBytes: number;
  checksumSha256?: string;
}

export interface IStorageService {
  generatePresignedUploadUrl(
    storagePath: string,
    contentType: string,
    expiresInSeconds?: number
  ): Promise<string>;

  generatePresignedDownloadUrl(
    storagePath: string,
    downloadFileName: string,
    expiresInSeconds?: number
  ): Promise<string>;

  headObject(storagePath: string): Promise<HeadObjectResult>;

  getObject(storagePath: string): Promise<string | Buffer | null>;

  putObject?(
    storagePath: string,
    content: Buffer,
    contentType?: string
  ): Promise<void>;

  findFilesByPrefix(prefix: string): Promise<string[]>;

  deleteObject(storagePath: string): Promise<void>;

  deletePrefix(prefix: string): Promise<void>;
}

