import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsS3StorageService } from './AwsS3StorageService.js';
import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockImplementation(async (_client, command, options) => {
    return `https://s3.ap-south-1.amazonaws.com/test-bucket/${command.input.Key}?expires=${options.expiresIn}`;
  }),
}));

describe('AwsS3StorageService', () => {
  let storageService: AwsS3StorageService;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new AwsS3StorageService({
      bucketName: 'test-vault-bucket',
      region: 'ap-south-1',
    });
    mockSend = vi.fn();
    (storageService as unknown as { s3Client: { send: unknown } }).s3Client.send = mockSend;
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate a presigned PUT URL with valid expiration', async () => {
      const url = await storageService.generatePresignedUploadUrl(
        'tenants/org_1/bids/bid_1/doc.pdf',
        'application/pdf',
        900,
      );

      expect(url).toContain(
        'https://s3.ap-south-1.amazonaws.com/test-bucket/tenants/org_1/bids/bid_1/doc.pdf',
      );
      expect(url).toContain('expires=900');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate a presigned GET URL with custom disposition header', async () => {
      const url = await storageService.generatePresignedDownloadUrl(
        'tenants/org_1/bids/bid_1/doc.pdf',
        'downloaded_doc.pdf',
        300,
      );

      expect(url).toContain(
        'https://s3.ap-south-1.amazonaws.com/test-bucket/tenants/org_1/bids/bid_1/doc.pdf',
      );
      expect(url).toContain('expires=300');
    });
  });

  describe('headObject', () => {
    it('should return existence and metadata when object exists in S3', async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 4096,
        ChecksumSHA256: 'sha256-hash-value',
      });

      const result = await storageService.headObject('tenants/org_1/bids/bid_1/doc.pdf');

      expect(result).toEqual({
        exists: true,
        sizeBytes: 4096,
        checksumSha256: 'sha256-hash-value',
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('should return exists: false when S3 throws 404 / NotFound', async () => {
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      Object.assign(notFoundError, { $metadata: { httpStatusCode: 404 } });
      mockSend.mockRejectedValueOnce(notFoundError);

      const result = await storageService.headObject('tenants/org_1/bids/bid_1/missing.pdf');

      expect(result).toEqual({
        exists: false,
        sizeBytes: 0,
      });
    });
  });

  describe('getObject', () => {
    it('should return object buffer when object exists', async () => {
      const sampleBuffer = Buffer.from('PDF Content Data');
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValueOnce(sampleBuffer),
        },
      });

      const result = await storageService.getObject('tenants/org_1/bids/bid_1/doc.pdf');

      expect(result).toEqual(sampleBuffer);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it('should return null when object does not exist', async () => {
      const notFoundError = new Error('NoSuchKey');
      notFoundError.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(notFoundError);

      const result = await storageService.getObject('tenants/org_1/bids/bid_1/missing.pdf');

      expect(result).toBeNull();
    });
  });
});
