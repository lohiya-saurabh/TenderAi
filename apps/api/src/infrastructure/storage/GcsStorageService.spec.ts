import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcsStorageService } from './GcsStorageService.js';

const mockGetSignedUrl = vi.fn();
const mockGetMetadata = vi.fn();
const mockDownload = vi.fn();

const mockFile = vi.fn().mockImplementation(() => ({
  getSignedUrl: mockGetSignedUrl,
  getMetadata: mockGetMetadata,
  download: mockDownload,
}));

const mockBucket = vi.fn().mockImplementation(() => ({
  file: mockFile,
}));

vi.mock('@google-cloud/storage', () => {
  return {
    Storage: vi.fn().mockImplementation(function () {
      return {
        bucket: mockBucket,
      };
    }),
  };
});

describe('GcsStorageService (Google Cloud Storage Adapter)', () => {
  let storageService: GcsStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService = new GcsStorageService({
      bucketName: 'tenderpulse-vault-gcp-dev',
      projectId: 'tenderpulse-gcp-test',
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('should request a V4 signed write URL with correct content-type and expiry', async () => {
      mockGetSignedUrl.mockResolvedValueOnce([
        'https://storage.googleapis.com/tenderpulse-vault-gcp-dev/tenants/org1/doc.pdf?X-Goog-Signature=test',
      ]);

      const url = await storageService.generatePresignedUploadUrl(
        'tenants/org1/doc.pdf',
        'application/pdf',
        600,
      );

      expect(mockBucket).toHaveBeenCalledWith('tenderpulse-vault-gcp-dev');
      expect(mockFile).toHaveBeenCalledWith('tenants/org1/doc.pdf');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'write',
          contentType: 'application/pdf',
        }),
      );
      expect(url).toContain('storage.googleapis.com');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should request a V4 signed read URL with response-content-disposition', async () => {
      mockGetSignedUrl.mockResolvedValueOnce([
        'https://storage.googleapis.com/tenderpulse-vault-gcp-dev/tenants/org1/doc.pdf?download=true',
      ]);

      const url = await storageService.generatePresignedDownloadUrl(
        'tenants/org1/doc.pdf',
        'NIT_Document.pdf',
        300,
      );

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'read',
          responseDisposition: 'attachment; filename="NIT_Document.pdf"',
        }),
      );
      expect(url).toContain('download=true');
    });
  });

  describe('headObject', () => {
    it('should return exists=true and size when object is found in GCS', async () => {
      mockGetMetadata.mockResolvedValueOnce([
        {
          size: 1048576,
          metadata: {
            checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
        },
      ]);

      const result = await storageService.headObject('tenants/org1/doc.pdf');

      expect(result.exists).toBe(true);
      expect(result.sizeBytes).toBe(1048576);
      expect(result.checksumSha256).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    it('should return exists=false and size=0 when object is not found (404)', async () => {
      const error = new Error('Not Found');
      (error as unknown as { code: number }).code = 404;
      mockGetMetadata.mockRejectedValueOnce(error);

      const result = await storageService.headObject('tenants/org1/missing.pdf');

      expect(result.exists).toBe(false);
      expect(result.sizeBytes).toBe(0);
    });

    it('should rethrow unexpected non-404 errors', async () => {
      const error = new Error('Permission Denied');
      (error as unknown as { code: number }).code = 403;
      mockGetMetadata.mockRejectedValueOnce(error);

      await expect(storageService.headObject('tenants/org1/secret.pdf')).rejects.toThrow(
        'Permission Denied',
      );
    });
  });

  describe('getObject', () => {
    it('should return file buffer when object exists', async () => {
      const content = Buffer.from('mock pdf content');
      mockDownload.mockResolvedValueOnce([content]);

      const result = await storageService.getObject('tenants/org1/doc.pdf');

      expect(result).toEqual(content);
    });

    it('should return null when object does not exist (404)', async () => {
      const error = new Error('Not Found');
      (error as unknown as { code: number }).code = 404;
      mockDownload.mockRejectedValueOnce(error);

      const result = await storageService.getObject('tenants/org1/missing.pdf');

      expect(result).toBeNull();
    });
  });
});
