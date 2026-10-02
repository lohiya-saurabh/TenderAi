import { describe, it, expect } from 'vitest';
import {
  InvalidStateTransitionException,
  ValidationException,
} from '../../../../common/domain/DomainException.js';
import { TenderDocument } from './TenderDocument.js';
import { DocumentStatus } from '../value-objects/DocumentStatus.js';

describe('TenderDocument Domain Entity & DocumentStatus Value Object', () => {
  const validProps = {
    id: 'doc-001',
    bidId: 'bid-100',
    organizationId: 'org-prime',
    documentType: 'NIT' as const,
    fileName: 'NIT_Package_2026.pdf',
    s3Key: 'tenants/org-prime/bids/bid-100/doc-001/NIT_Package_2026.pdf',
    sizeBytes: 15 * 1024 * 1024, // 15MB
    mimeType: 'application/pdf',
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  describe('Instantiation & Invariants', () => {
    it('should create a valid TenderDocument in PENDING_UPLOAD status', () => {
      const doc = new TenderDocument(validProps);

      expect(doc.id).toBe('doc-001');
      expect(doc.bidId).toBe('bid-100');
      expect(doc.organizationId).toBe('org-prime');
      expect(doc.documentType).toBe('NIT');
      expect(doc.status.value).toBe('PENDING_UPLOAD');
      expect(doc.version).toBe(1);
    });

    it('should throw ValidationException if file size is 0 or negative', () => {
      expect(() => new TenderDocument({ ...validProps, sizeBytes: 0 })).toThrow(
        ValidationException
      );
      expect(() => new TenderDocument({ ...validProps, sizeBytes: -500 })).toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException if file size exceeds 100MB', () => {
      expect(() => new TenderDocument({ ...validProps, sizeBytes: 101 * 1024 * 1024 })).toThrow(
        ValidationException
      );
    });

    it('should throw ValidationException if MIME type is unsupported', () => {
      expect(
        () => new TenderDocument({ ...validProps, mimeType: 'application/x-executable' })
      ).toThrow(ValidationException);
    });

    it('should throw ValidationException if SHA-256 checksum is not 64 hex characters', () => {
      expect(() => new TenderDocument({ ...validProps, checksumSha256: 'invalid-hex' })).toThrow(
        ValidationException
      );
      expect(
        () =>
          new TenderDocument({
            ...validProps,
            checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85', // 63 chars
          })
      ).toThrow(ValidationException);
    });
  });

  describe('Document Lifecycle Transitions', () => {
    it('should transition from PENDING_UPLOAD to VERIFIED and increment version', () => {
      const doc = new TenderDocument(validProps);
      expect(doc.status.value).toBe('PENDING_UPLOAD');
      expect(doc.version).toBe(1);

      doc.markVerified();
      expect(doc.status.value).toBe('VERIFIED');
      expect(doc.version).toBe(2);
    });

    it('should transition from PENDING_UPLOAD to FAILED and increment version', () => {
      const doc = new TenderDocument(validProps);
      doc.markFailed();
      expect(doc.status.value).toBe('FAILED');
      expect(doc.version).toBe(2);
    });

    it('should disallow invalid transitions (e.g. from VERIFIED back to PENDING_UPLOAD)', () => {
      const doc = new TenderDocument(validProps);
      doc.markVerified();
      expect(() => doc.status.transitionTo(DocumentStatus.PENDING_UPLOAD)).toThrow(
        InvalidStateTransitionException
      );
    });
  });
});
