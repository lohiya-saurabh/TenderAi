import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import { AuthService } from '../auth/auth.service.js';
import { BidsService } from '../bids/bids.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../common/errors/errors.js';

describe('NestJS Feature Modules: Services Unit Tests', () => {
  let db: PGlite;
  let authService: AuthService;
  let bidsService: BidsService;
  let documentsService: DocumentsService;
  let complianceService: ComplianceService;
  let auditService: AuditService;
  let mockStorage: MockStorageService;

  const sampleTenderContent = `--- PAGE 1 ---
SECTION 1: INVITATION FOR BIDS (NIT)
The bidder must submit Bid Security / Earnest Money Deposit (EMD) of INR 10,00,000 on a non-judicial stamp paper.
Power of Attorney executed on non-judicial stamp paper in favor of lead member of consortium.

--- PAGE 2 ---
SECTION 2: QUALIFICATION REQUIREMENTS
The Bidder shall have minimum annual turnover of INR 50 Crores with CA certificate bearing valid UDIN.
The Bidder must demonstrate prior completion of similar work in EPC infrastructure works within last 7 years.

--- PAGE 3 ---
SECTION 3: STATUTORY & LEGAL UNDERTAKINGS
The Bidder shall submit the Integrity Pact duly signed and sealed along with declaration of no active blacklisting or debarment.
Declaration of Class-I local supplier under Public Procurement Preference to Make in India (PPP-MII) with 50% local content.
`;

  beforeAll(async () => {
    // Initialize in-memory PGlite with schema and clean seed state
    db = new PGlite();
    await initDatabase(db);

    mockStorage = new MockStorageService();
    authService = new AuthService(db);
    bidsService = new BidsService(db);
    documentsService = new DocumentsService(db, mockStorage);
    complianceService = new ComplianceService(db);
    auditService = new AuditService(db);
  });

  describe('AuthService', () => {
    it('should authenticate demo user with correct credentials', async () => {
      const result = await authService.login('bidmanager@acme.com', 'Password123!');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('bidmanager@acme.com');
      expect(result.user.role).toBe('bid_manager');
    });

    it('should throw UnauthorizedError when credentials do not match', async () => {
      await expect(authService.login('bidmanager@acme.com', 'WrongPassword')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should throw UnauthorizedError when user does not exist (timing attack defense path)', async () => {
      await expect(authService.login('nonexistent@acme.com', 'AnyPassword123!')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should refresh demo tokens', async () => {
      const result = await authService.refresh();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('BidsService', () => {
    it('should list all demo bids', async () => {
      const bids = await bidsService.listBids();
      expect(bids.length).toBeGreaterThan(0);
    });

    it('should get a single bid by ID', async () => {
      const bid = await bidsService.getBidById('bid-cpwd-gov-002');
      expect(bid.id).toBe('bid-cpwd-gov-002');
      expect(bid.tenderingAuthority).toBe('Central Public Works Department (CPWD)');
    });

    it('should throw NotFoundError for non-existent bid', async () => {
      await expect(bidsService.getBidById('non-existent-id')).rejects.toThrow(NotFoundError);
    });

    it('should create a new bid with audit trail initialization', async () => {
      const newBid = await bidsService.createBid({
        title: 'Airport Runway Resurfacing Phase 3',
        tenderNumber: 'AAI-2026-ENG-991',
        tenderingAuthority: 'Airports Authority of India',
        estimatedValueRupees: 450000000,
      });

      expect(newBid.id).toMatch(/^bid-/);
      expect(newBid.status).toBe('DRAFT');
      expect(newBid.title).toBe('Airport Runway Resurfacing Phase 3');

      const found = await bidsService.getBidById(newBid.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(newBid.id);
    });

    it('should delete a bid project, cascade delete documents and compliance items, and record audit event', async () => {
      // 1. Create a bid to delete
      const bid = await bidsService.createBid({
        title: 'Bid to be deleted',
        tenderNumber: 'DEL-2026-001',
      });

      // 2. Upload a document to this bid with genuine clauses
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/${bid.id}/doc-to-delete-01/Uploaded_Tender_Document.pdf`,
        1024,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sampleTenderContent
      );
      await documentsService.confirmUpload(bid.id, 'doc-to-delete-01');

      // 3. Mark extraction complete to generate compliance items
      await documentsService.markExtractionComplete(bid.id, 'doc-to-delete-01');

      // Verify compliance items exist
      const beforeCompliance = await complianceService.listItems(bid.id);
      expect(beforeCompliance.length).toBeGreaterThan(0);

      // 4. Delete the bid using two-phase deletion
      const deleteResult = await bidsService.deleteBid(bid.id, 'org_acme_infra_001');
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedBidId).toBe(bid.id);
      expect(deleteResult.deletedDocumentsCount).toBe(1);

      // 5. Verify bid is deleted
      await expect(bidsService.getBidById(bid.id)).rejects.toThrow(NotFoundError);

      // 6. Verify cascade deleted compliance items
      const afterCompliance = await complianceService.listItems(bid.id);
      expect(afterCompliance.length).toBe(0);

      // 7. Verify deletion audit log is recorded
      const auditEvents = await auditService.listEvents(bid.id);
      const deleteEvent = auditEvents.find((e) => e.eventType === 'BID_PROJECT_DELETED');
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent?.aggregateId).toBe(bid.id);
    });

    it('should throw NotFoundError when deleting non-existent bid', async () => {
      await expect(bidsService.deleteBid('non-existent-bid-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('DocumentsService', () => {
    it('should generate presigned upload URL when storage service is configured', async () => {
      const res = await documentsService.generateUploadUrl(
        'bid-cpwd-gov-002',
        'tender_doc.pdf',
        'application/pdf'
      );
      expect(res.documentId).toMatch(/^doc-/);
      expect(res.uploadUrl).toContain('mock-s3.tenderpulse.local');
      expect(res.storagePath).toContain('tenants/org_acme_infra_001/bids/bid-cpwd-gov-002');
    });

    it('should generate fallback mock upload URL when storage service is null', async () => {
      const nullDocService = new DocumentsService(db, null);
      const res = await nullDocService.generateUploadUrl(
        'bid-cpwd-gov-002',
        'tender_doc.pdf',
        'application/pdf'
      );
      expect(res.documentId).toMatch(/^doc-/);
      expect(res.uploadUrl).toContain('/api/v1/mock-upload/');
      expect(res.storagePath).toContain('tenants/org_acme_infra_001/bids/bid-cpwd-gov-002');
    });

    it('should confirm document upload, persist to database, and update status', async () => {
      const testBid = await bidsService.createBid({ title: 'Test Bid For Documents' });

      const res = await documentsService.confirmUpload(testBid.id, 'doc-test-123');
      expect(res.documentId).toBe('doc-test-123');
      expect(res.status).toBe('UPLOADED');

      const updatedBid = await bidsService.getBidById(testBid.id);
      expect(updatedBid.status).toBe('REVIEW_READY');
      expect(updatedBid.documents.length).toBe(1);
      expect(updatedBid.documents[0]!.id).toBe('doc-test-123');
    });

    it('should mark extraction complete and generate compliance items into PostgreSQL from real document content', async () => {
      const testBid = await bidsService.createBid({ title: 'Test Bid For Extraction' });
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/${testBid.id}/doc-extract-test/Uploaded_Tender_Document.pdf`,
        1024,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sampleTenderContent
      );
      await documentsService.confirmUpload(testBid.id, 'doc-extract-test');

      await documentsService.markExtractionComplete(testBid.id, 'doc-extract-test');

      const items = await complianceService.listItems(testBid.id);
      expect(items.length).toBe(7);
      expect(items.some((i) => i.category === 'STATUTORY')).toBe(true);
      expect(items.some((i) => i.category === 'FINANCIAL')).toBe(true);
      expect(items.some((i) => i.category === 'EXECUTION')).toBe(true);
      expect(items.some((i) => i.category === 'TECHNICAL')).toBe(true);
      expect(items.some((i) => i.category === 'LEGAL')).toBe(true);

      const updatedBid = await bidsService.getBidById(testBid.id);
      expect(updatedBid.totalRequirements).toBe(7);
    });

    it('should extract 0 compliance items and fabricate no mock data when document contains no compliance clauses', async () => {
      const testBid = await bidsService.createBid({ title: 'Test Bid For Empty Document' });
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/${testBid.id}/doc-empty-test/Uploaded_Tender_Document.pdf`,
        500,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'This is a simple general notice without any procurement clauses or tender requirements.'
      );
      await documentsService.confirmUpload(testBid.id, 'doc-empty-test');

      await documentsService.markExtractionComplete(testBid.id, 'doc-empty-test');

      const items = await complianceService.listItems(testBid.id);
      expect(items.length).toBe(0);

      const updatedBid = await bidsService.getBidById(testBid.id);
      expect(updatedBid.totalRequirements).toBe(0);
      expect(updatedBid.flaggedRequirements).toBe(0);
      expect(updatedBid.approvedRequirements).toBe(0);
    });

    it('should generate download URL for uploaded document', async () => {
      const res = await documentsService.getDownloadUrl(
        'bid-cpwd-gov-002',
        'doc-test-123',
        'localhost:3000'
      );
      expect(res.downloadUrl).toBeDefined();
      expect(res.expiresInSeconds).toBe(3600);
    });

    it('should delete an uploaded document, remove associated compliance items, recalculate parent bid metrics, and record audit log', async () => {
      // 1. Create a fresh bid
      const testBid = await bidsService.createBid({ title: 'Test Bid For Document Deletion' });

      // 2. Upload document with sample tender text
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/${testBid.id}/doc-to-remove-123/Uploaded_Tender_Document.pdf`,
        1024,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sampleTenderContent
      );
      await documentsService.confirmUpload(testBid.id, 'doc-to-remove-123');

      // 3. Mark extraction complete to populate compliance items citing this doc
      await documentsService.markExtractionComplete(testBid.id, 'doc-to-remove-123');

      const itemsBefore = await complianceService.listItems(testBid.id);
      expect(itemsBefore.length).toBe(7);

      // 4. Delete document
      const delResult = await documentsService.deleteDocument(
        testBid.id,
        'doc-to-remove-123',
        'org_acme_infra_001'
      );
      expect(delResult.success).toBe(true);
      expect(delResult.deletedDocumentId).toBe('doc-to-remove-123');
      expect(delResult.removedCompliancesCount).toBe(7);

      // 5. Verify document is gone from bid
      const updatedBid = await bidsService.getBidById(testBid.id);
      expect(updatedBid.documents.length).toBe(0);
      expect(updatedBid.totalRequirements).toBe(0);
      expect(updatedBid.status).toBe('DRAFT');

      // 6. Verify compliance items derived from this doc are deleted
      const itemsAfter = await complianceService.listItems(testBid.id);
      expect(itemsAfter.length).toBe(0);

      // 7. Verify audit log entry
      const auditEvents = await auditService.listEvents(testBid.id);
      const docDelEvent = auditEvents.find((e) => e.eventType === 'DOCUMENT_DELETED');
      expect(docDelEvent).toBeDefined();
      expect(docDelEvent?.aggregateId).toBe('doc-to-remove-123');
    });

    it('should throw NotFoundError when deleting non-existent document or document from wrong tenant', async () => {
      await expect(
        documentsService.deleteDocument('bid-cpwd-gov-002', 'non-existent-doc-id')
      ).rejects.toThrow(NotFoundError);

      await expect(
        documentsService.deleteDocument('bid-cpwd-gov-002', 'doc-test-123', 'unauthorized_org')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('ComplianceService', () => {
    beforeAll(async () => {
      // Seed an uploaded document with real tender clauses for bid-cpwd-gov-002
      const cpwdDocId = 'doc-cpwd-001';
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/bid-cpwd-gov-002/${cpwdDocId}/Uploaded_Tender_Document.pdf`,
        2048,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sampleTenderContent
      );
      await documentsService.confirmUpload('bid-cpwd-gov-002', cpwdDocId);
      await documentsService.markExtractionComplete('bid-cpwd-gov-002', cpwdDocId);
    });

    it('should list compliance items for a bid', async () => {
      const items = await complianceService.listItems('bid-cpwd-gov-002');
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('should get a single compliance item by ID', async () => {
      const items = await complianceService.listItems('bid-cpwd-gov-002');
      expect(items.length).toBeGreaterThan(0);

      const item = await complianceService.getItemById('bid-cpwd-gov-002', items[0]!.id);
      expect(item).toBeDefined();
      expect(item.id).toBe(items[0]!.id);
    });

    it('should throw NotFoundError when compliance item does not exist', async () => {
      await expect(
        complianceService.getItemById('bid-cpwd-gov-002', 'invalid-comp-id')
      ).rejects.toThrow(NotFoundError);
    });

    it('should enforce optimistic concurrency control on reviewItem', async () => {
      const items = await complianceService.listItems('bid-cpwd-gov-002');
      expect(items.length).toBeGreaterThan(0);

      const item = items[0]!;
      // Wrong version should throw ConflictError
      await expect(
        complianceService.reviewItem('bid-cpwd-gov-002', item.id, {
          status: 'READY',
          expectedVersion: item.version + 999,
        })
      ).rejects.toThrow(ConflictError);

      // Correct version should succeed
      const currentVersion = item.version;
      const updated = await complianceService.reviewItem('bid-cpwd-gov-002', item.id, {
        status: 'READY',
        notes: 'Unit test verified',
        expectedVersion: currentVersion,
      });
      expect(updated.version).toBe(currentVersion + 1);
      expect(updated.status).toBe('READY');
      expect(updated.reviewNotes).toBe('Unit test verified');
    });
  });

  describe('AuditService', () => {
    it('should list audit events for a bid', async () => {
      const events = await auditService.listEvents('bid-cpwd-gov-002');
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
