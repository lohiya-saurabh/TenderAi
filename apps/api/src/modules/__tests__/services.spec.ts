import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { AuthService } from '../auth/auth.service.js';
import { BidsService } from '../bids/bids.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CompanyProfileService } from '../company-profile/company-profile.service.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import type { IStorageService } from '../bids/application/IStorageService.js';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../common/errors/errors.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';

describe('NestJS Feature Modules: Services Unit Tests', () => {
  let db: PGlite;
  let authService: AuthService;
  let bidsService: BidsService;
  let documentsService: DocumentsService;
  let complianceService: ComplianceService;
  let auditService: AuditService;
  let companyProfileService: CompanyProfileService;
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
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });

    mockStorage = new MockStorageService();
    authService = new AuthService(db);
    bidsService = new BidsService(db);
    documentsService = new DocumentsService(db, mockStorage);
    complianceService = new ComplianceService(db);
    auditService = new AuditService(db);
    companyProfileService = new CompanyProfileService(db);
  });

  beforeEach(() => {
    TenantContextHolder.enter({
      organizationId: 'org_acme_infra_001',
      userId: 'usr_bid_mgr_01',
      role: 'BID_MANAGER',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('AuthService', () => {
    it('should authenticate demo user with correct credentials', async () => {
      const result = await authService.login('bidmanager@acme.com', 'Password123!');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('bidmanager@acme.com');
      expect(result.user.role).toBe('BID_MANAGER');
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

    it('should refresh demo tokens with genuine refresh token and reject empty', async () => {
      const loginResult = await authService.login('bidmanager@acme.com', 'Password123!');
      const result = await authService.refresh(loginResult.refreshToken);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      await expect(authService.refresh()).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh('tampered.invalid.token')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('BidsService', () => {
    it('should list all demo bids', async () => {
      const bids = await bidsService.listBids();
      const items = Array.isArray(bids) ? bids : bids.items;
      expect(items.length).toBeGreaterThan(0);
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
    it('should generate presigned upload URL when cloud storage service is configured', async () => {
      const cloudStorage: IStorageService = {
        generatePresignedUploadUrl: async () => 'https://vault.s3.ap-south-1.amazonaws.com/doc.pdf?X-Amz-Signature=test',
        generatePresignedDownloadUrl: async () => 'https://vault.s3.ap-south-1.amazonaws.com/doc.pdf?sig=test',
        headObject: async () => ({ exists: true, sizeBytes: 100 }),
        getObject: async () => Buffer.from('test'),
        deleteObject: async () => {},
        deletePrefix: async () => {},
      };
      const cloudDocService = new DocumentsService(db, cloudStorage);
      const res = await cloudDocService.generateUploadUrl(
        'bid-cpwd-gov-002',
        'tender_doc.pdf',
        'application/pdf'
      );
      expect(res.documentId).toMatch(/^doc-/);
      expect(res.uploadUrl).toContain('vault.s3.ap-south-1.amazonaws.com');
      expect(res.storagePath).toContain('tenants/org_acme_infra_001/bids/bid-cpwd-gov-002');
    });

    it('should route mock storage to working local mock-upload endpoint', async () => {
      const res = await documentsService.generateUploadUrl(
        'bid-cpwd-gov-002',
        'tender_doc.pdf',
        'application/pdf'
      );
      expect(res.documentId).toMatch(/^doc-/);
      expect(res.uploadUrl).toContain('/api/v1/mock-upload/');
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
      const storagePath = `tenants/org_acme_infra_001/bids/${testBid.id}/doc-test-123/Uploaded_Tender_Document.pdf`;
      mockStorage.simulateUploadedObject(storagePath, 1024, undefined, Buffer.from(sampleTenderContent));

      const res = await documentsService.confirmUpload(testBid.id, 'doc-test-123');
      expect(res.documentId).toBe('doc-test-123');
      expect(res.status).toBe('UPLOADED');

      const updatedBid = await bidsService.getBidById(testBid.id);
      expect(updatedBid.status).toBe('QUEUED');
      expect(updatedBid.documents.length).toBe(1);
      expect(updatedBid.documents[0]!.id).toBe('doc-test-123');

      const [outboxRecord] = await createDrizzle(db)
        .select()
        .from(schema.documentProcessingOutbox)
        .where(eq(schema.documentProcessingOutbox.id, 'outbox-doc-test-123'))
        .limit(1);
      expect(outboxRecord?.status).toBe('PENDING');
      expect(outboxRecord?.payload).toMatchObject({
        organizationId: 'org_acme_infra_001',
        companyId: testBid.companyId,
        bidId: testBid.id,
        documentId: 'doc-test-123',
        storageReference: storagePath,
      });
    });

    it('should not persist or queue upload confirmation when the object is absent', async () => {
      const testBid = await bidsService.createBid({ title: 'Bid With Missing Upload' });
      await expect(documentsService.confirmUpload(testBid.id, 'doc-missing-object')).rejects.toThrow(
        'Uploaded document is missing or empty in object storage',
      );

      const documents = await createDrizzle(db)
        .select()
        .from(schema.tenderDocuments)
        .where(eq(schema.tenderDocuments.id, 'doc-missing-object'));
      const outbox = await createDrizzle(db)
        .select()
        .from(schema.documentProcessingOutbox)
        .where(eq(schema.documentProcessingOutbox.id, 'outbox-doc-missing-object'));
      expect(documents).toHaveLength(0);
      expect(outbox).toHaveLength(0);
    });

    it('should queue reprocessing of a completed document with a new durable job', async () => {
      const testBid = await bidsService.createBid({ title: 'Bid For Citation Refresh' });
      const docId = 'doc-citation-refresh';
      const storagePath = `tenants/org_acme_infra_001/bids/${testBid.id}/${docId}/Uploaded_Tender_Document.pdf`;
      mockStorage.simulateUploadedObject(storagePath, 2048, undefined, Buffer.from(sampleTenderContent));
      await documentsService.confirmUpload(testBid.id, docId);
      await createDrizzle(db)
        .update(schema.tenderDocuments)
        .set({ status: 'COMPLETED' })
        .where(eq(schema.tenderDocuments.id, docId));

      const result = await documentsService.reprocessDocument(testBid.id, docId);
      expect(result.documentId).toBe(docId);
      expect(result.status).toBe('QUEUED_FOR_EXTRACTION');

      const [document] = await createDrizzle(db)
        .select()
        .from(schema.tenderDocuments)
        .where(eq(schema.tenderDocuments.id, docId));
      const [outbox] = await createDrizzle(db)
        .select()
        .from(schema.documentProcessingOutbox)
        .where(eq(schema.documentProcessingOutbox.id, `outbox-${result.jobId}`));
      expect(document?.status).toBe('QUEUED_FOR_EXTRACTION');
      expect(outbox?.status).toBe('PENDING');
      expect(outbox?.payload).toMatchObject({
        documentId: docId,
        jobId: result.jobId,
        storageReference: storagePath,
      });
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

    it('should keep prior tender timeline text out of the EMD provenance quote', async () => {
      vi.stubEnv('AI_ENGINE_URL', 'http://127.0.0.1:65534');
      const testBid = await bidsService.createBid({ title: 'Bid For EMD Citation' });
      const documentId = 'doc-emd-citation';
      const content = [
        'https://eprocure.gov.in/eprocure/app CPP portal on or before 09-10-2026 (upto',
        '16:00 hrs IST). Bids received online will be opened on 12-10-2026 (at 16:00 hrs',
        'IST)',
        'Queries/Clarifications if any may be submitted on or before 05-10-2026',
        'upto 15:00 hrs IST)',
        'The EMD shall be paid in the form of Bank Guarantee/FDR drawn in',
        'favour of the Executive Engineer National Highway Division Hassan, obtained',
        'from any Nationalized/Scheduled Banks payable at Hassan.',
      ].join('\n');
      mockStorage.simulateUploadedObject(
        `tenants/org_acme_infra_001/bids/${testBid.id}/${documentId}/Uploaded_Tender_Document.pdf`,
        Buffer.byteLength(content),
        undefined,
        Buffer.from(content),
      );
      await documentsService.confirmUpload(testBid.id, documentId);
      await documentsService.markExtractionComplete(testBid.id, documentId);

      const items = await complianceService.listItems(testBid.id);
      const emdItem = items.find((item) => item.title === 'Tender & Bid Security (EMD) Guarantee');
      expect(emdItem?.provenance.verbatimQuote).toBe(
        'The EMD shall be paid in the form of Bank Guarantee/FDR drawn in ' +
          'favour of the Executive Engineer National Highway Division Hassan, obtained ' +
          'from any Nationalized/Scheduled Banks payable at Hassan.',
      );
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

    it('should get evidence matches with coverage rollup', async () => {
      const result = await complianceService.getEvidenceMatches('bid-nhai-44-001');
      expect(result.bidId).toBe('bid-nhai-44-001');
      expect(result.totalRequirements).toBeGreaterThan(0);
      expect(result.matches.length).toBe(result.totalRequirements);
      expect(typeof result.coveragePct).toBe('number');

      const firstMatch = result.matches[0]!;
      expect(firstMatch.complianceItemId).toBeDefined();
      expect(firstMatch.tenderCitation).toBeDefined();
      expect(['MATCHED', 'UNMATCHED', 'PARTIAL', 'EXPIRED']).toContain(firstMatch.matchStatus);
    });

    it('should get consolidated statutory and commercial risk findings', async () => {
      const result = await complianceService.getRiskFindings('bid-nhai-44-001');
      expect(result.bidId).toBe('bid-nhai-44-001');
      expect(result.tenderNumber).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalRisks).toBe('number');
      expect(Array.isArray(result.statutoryRisks)).toBe(true);
      expect(Array.isArray(result.commercialRisks)).toBe(true);
    });
  });

  describe('BidsService Lifecycle Deadlines & Metrics', () => {
    it('should compute tender lifecycle deadlines', async () => {
      const deadlines = await bidsService.getTenderDeadlines('bid-nhai-44-001');
      expect(deadlines.bidId).toBe('bid-nhai-44-001');
      expect(Array.isArray(deadlines.milestones)).toBe(true);
      expect(deadlines.milestones.length).toBe(6);

      const milestoneKeys = deadlines.milestones.map((m) => m.milestoneKey);
      expect(milestoneKeys).toContain('PRE_BID_MEETING');
      expect(milestoneKeys).toContain('CLARIFICATION_CUTOFF');
      expect(milestoneKeys).toContain('EMD_SUBMISSION');
      expect(milestoneKeys).toContain('BID_SUBMISSION_FREEZE');
      expect(milestoneKeys).toContain('TECHNICAL_BID_OPENING');
      expect(milestoneKeys).toContain('FINANCIAL_BID_OPENING');
    });

    it('should compute aggregated dashboard metrics for tenant', async () => {
      const metrics = await bidsService.getDashboardMetrics();
      expect(metrics.activePipelineCount).toBeGreaterThan(0);
      expect(typeof metrics.totalPipelineValueRupees).toBe('number');
      expect(typeof metrics.totalFlaggedRequirements).toBe('number');
      expect(metrics.pipelineDistribution).toBeDefined();
      expect(typeof metrics.pipelineDistribution.DRAFT).toBe('number');
    });

    it('should support server-side pagination, status filtering, and search in listBids', async () => {
      const paginated = await bidsService.listBids({ page: 1, limit: 2, sort: 'createdAt', order: 'desc' });
      expect('items' in paginated).toBe(true);
      if ('items' in paginated) {
        expect(paginated.page).toBe(1);
        expect(paginated.limit).toBe(2);
        expect(paginated.items.length).toBeLessThanOrEqual(2);
        expect(paginated.total).toBeGreaterThan(0);
        expect(paginated.totalPages).toBeGreaterThan(0);
      }

      // Filter by status
      const reviewReady = await bidsService.listBids({ status: 'REVIEW_READY' });
      if ('items' in reviewReady) {
        expect(reviewReady.items.every((b) => b.status === 'REVIEW_READY')).toBe(true);
      }

      // Keyword search
      const searched = await bidsService.listBids({ search: 'NHAI' });
      if ('items' in searched) {
        expect(searched.items.length).toBeGreaterThan(0);
        expect(searched.items[0]!.title.toLowerCase().includes('nh') || searched.items[0]!.tenderingAuthority.includes('NHAI')).toBe(true);
      }
    });

    it('should list corrigendum and amendment notifications with impact analysis', async () => {
      const amendments = await bidsService.getTenderAmendments();
      expect(amendments.organizationId).toBe('org_acme_infra_001');
      expect(Array.isArray(amendments.amendments)).toBe(true);
      expect(typeof amendments.totalAmendments).toBe('number');
      if (amendments.amendments.length > 0) {
        const first = amendments.amendments[0]!;
        expect(first.id).toBeDefined();
        expect(first.bidId).toBeDefined();
        expect(first.corrigendumNumber).toBeDefined();
        expect(first.impact).toBeDefined();
        expect(typeof first.impact.deadlineChanged).toBe('boolean');
      }
    });
  });

  describe('CompanyProfileService Expiring Certificates', () => {
    it('should list certificates and OEM authorizations with remaining validity', async () => {
      await TenantContextHolder.run(
        {
          organizationId: 'org_acme_infra_001',
          userId: 'usr_bid_mgr_01',
          role: 'BID_MANAGER',
        },
        async () => {
          const expiring = await companyProfileService.getExpiringCertificates(3650);
          expect(expiring.organizationId).toBe('org_acme_infra_001');
          expect(expiring.activeProfileVersionId).toBeDefined();
          expect(Array.isArray(expiring.certificates)).toBe(true);
          expect(expiring.certificates.length).toBeGreaterThan(0);

          const firstCert = expiring.certificates[0]!;
          expect(firstCert.entryId).toBeDefined();
          expect(firstCert.name).toBeDefined();
          expect(typeof firstCert.daysRemaining).toBe('number');
          expect(typeof firstCert.isExpired).toBe('boolean');
        },
      );
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
