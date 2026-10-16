import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '@/common/database/IUnitOfWork.js';
import {
  EntityNotFoundException,
  UnauthorizedTenantAccessException,
  ValidationException,
} from '@/common/domain/DomainException.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { InMemoryAuditRepository } from '@/modules/audit/infrastructure/InMemoryAuditRepository.js';
import { CreateBidUseCase } from '@/modules/bids/application/CreateBidUseCase.js';
import { GenerateUploadUrlUseCase } from '@/modules/bids/application/GenerateUploadUrlUseCase.js';
import { ConfirmDocumentUploadUseCase } from '@/modules/bids/application/ConfirmDocumentUploadUseCase.js';
import { GetDocumentDownloadUrlUseCase } from '@/modules/bids/application/GetDocumentDownloadUrlUseCase.js';
import { BidsController } from '@/modules/bids/presentation/BidsController.js';
import { InMemoryBidRepository } from '@/infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryTenderDocumentRepository } from '@/infrastructure/persistence/InMemoryTenderDocumentRepository.js';
import { MockStorageService } from '@/infrastructure/storage/MockStorageService.js';

describe('E2E: Core Business Workflow WITHOUT AI (Bid Ingestion, Direct S3 Handshake & RBAC Security)', () => {
  let bidRepo: InMemoryBidRepository;
  let documentRepo: InMemoryTenderDocumentRepository;
  let auditRepo: InMemoryAuditRepository;
  let storageService: MockStorageService;
  let unitOfWork: DirectUnitOfWork;

  let bidsController: BidsController;

  const tenantA = 'org-contractor-alpha';
  const tenantB = 'org-contractor-competitor-beta';

  const bidManagerUser = 'usr-bid-manager-1';
  const viewerUser = 'usr-viewer-1';

  const validChecksum = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';

  beforeEach(() => {
    bidRepo = new InMemoryBidRepository();
    documentRepo = new InMemoryTenderDocumentRepository();
    auditRepo = new InMemoryAuditRepository();
    storageService = new MockStorageService();
    unitOfWork = new DirectUnitOfWork();

    const createBidUseCase = new CreateBidUseCase(bidRepo, auditRepo, unitOfWork);
    const generateUploadUrlUseCase = new GenerateUploadUrlUseCase(
      bidRepo,
      documentRepo,
      storageService,
      auditRepo,
      unitOfWork,
    );
    const confirmDocumentUploadUseCase = new ConfirmDocumentUploadUseCase(
      bidRepo,
      documentRepo,
      storageService,
      auditRepo,
      unitOfWork,
    );
    const getDocumentDownloadUrlUseCase = new GetDocumentDownloadUrlUseCase(
      bidRepo,
      documentRepo,
      storageService,
      auditRepo,
    );

    bidsController = new BidsController(
      createBidUseCase,
      generateUploadUrlUseCase,
      confirmDocumentUploadUseCase,
      getDocumentDownloadUrlUseCase,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Happy Path: Complete Bid Registration & Direct S3 Upload Handshake
  // ---------------------------------------------------------------------------
  it('should successfully execute the complete business workflow: Create Bid -> Request Presigned URL -> Upload to S3 -> Confirm Handshake -> Queue Bid', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        // Step 1: Create a new Bid Project with future deadline
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const createdBid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Construction of Elevated Corridor NH-24',
          tenderNumber: 'NHAI/DEL/2026/EC-24',
          tenderingAuthority: 'NHAI',
          estimatedValueRupees: 120000000, // ₹12 Crore
          submissionDeadline: futureDate,
        });

        expect(createdBid.id).toBeDefined();
        expect(createdBid.status).toBe('DRAFT');
        expect(createdBid.version).toBe(1);
        expect(createdBid.estimatedValueFormatted).toContain('12,00,00,000');

        // Step 2: Request Direct S3 Presigned Upload URL
        const uploadHandshake = await bidsController.generateUploadUrl(
          tenantA,
          bidManagerUser,
          createdBid.id,
          {
            documentType: 'NIT',
            fileName: 'NIT_Standard_Bidding_Doc.pdf',
            sizeBytes: 24 * 1024 * 1024, // 24MB
            mimeType: 'application/pdf',
            checksumSha256: validChecksum,
          },
        );

        expect(uploadHandshake.documentId).toBeDefined();
        expect(uploadHandshake.uploadUrl).toContain('https://mock-s3.tenderpulse.local/');
        expect(uploadHandshake.s3Key).toContain(`tenants/${tenantA}/bids/${createdBid.id}`);

        // Verify document is in PENDING_UPLOAD state in repository
        const pendingDoc = await documentRepo.findById(uploadHandshake.documentId, tenantA);
        expect(pendingDoc).not.toBeNull();
        expect(pendingDoc?.status.value).toBe('PENDING_UPLOAD');
        expect(pendingDoc?.version).toBe(1);

        // Step 3: Simulate Client Direct HTTP PUT to S3
        storageService.simulateUploadedObject(
          uploadHandshake.s3Key,
          24 * 1024 * 1024,
          validChecksum,
        );

        // Step 4: Confirm Document Upload Handshake
        const confirmResult = await bidsController.confirmDocumentUpload(
          tenantA,
          bidManagerUser,
          createdBid.id,
          { documentId: uploadHandshake.documentId },
        );

        expect(confirmResult.documentStatus).toBe('VERIFIED');
        expect(confirmResult.bidStatus).toBe('QUEUED');
        expect(confirmResult.version).toBe(2);

        // Step 5: Verify Persisted Aggregates and Audit Trail
        const verifiedDoc = await documentRepo.findById(uploadHandshake.documentId, tenantA);
        expect(verifiedDoc?.status.value).toBe('VERIFIED');
        expect(verifiedDoc?.version).toBe(2);

        const queuedBid = await bidRepo.findById(createdBid.id, tenantA);
        expect(queuedBid?.status.value).toBe('QUEUED');
        expect(queuedBid?.version).toBe(2);

        // Step 6: Secure Authorized Document Download Retrieval
        const downloadResult = await bidsController.getDocumentDownloadUrl(
          tenantA,
          bidManagerUser,
          createdBid.id,
          uploadHandshake.documentId,
        );

        expect(downloadResult.documentId).toBe(uploadHandshake.documentId);
        expect(downloadResult.downloadUrl).toContain('response-content-disposition=attachment');
        expect(downloadResult.fileName).toBe('NIT_Standard_Bidding_Doc.pdf');
        expect(downloadResult.expiresInSeconds).toBe(300);

        const logs = auditRepo.getAll();
        const actions = logs.map((l) => l.action);
        expect(actions).toContain('CREATE_BID');
        expect(actions).toContain('GENERATE_UPLOAD_URL');
        expect(actions).toContain('CONFIRM_DOCUMENT_UPLOAD');
        expect(actions).toContain('DOWNLOAD_DOCUMENT');
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Tenant Authorization & IDOR Defense (Cross-Tenant Access)
  // ---------------------------------------------------------------------------
  it('should block cross-tenant IDOR attack when Tenant B attempts to generate upload URL for Tenant A bid', async () => {
    // Tenant A creates bid
    let tenantABidId = '';
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Confidential Defense Project',
          tenderNumber: 'DEF/2026/099',
          tenderingAuthority: 'Ministry of Defence',
          estimatedValueRupees: 50000000,
          submissionDeadline: futureDate,
        });
        tenantABidId = bid.id;
      },
    );

    // Tenant B attempts to tamper with Tenant A's bid
    await TenantContextHolder.run(
      { organizationId: tenantB, userId: 'usr-competitor-hacker', role: 'BID_MANAGER' },
      async () => {
        await expect(
          bidsController.generateUploadUrl(tenantB, 'usr-competitor-hacker', tenantABidId, {
            documentType: 'NIT',
            fileName: 'PoisonedDoc.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(EntityNotFoundException); // Anti-IDOR: Returns 404, never 403
      },
    );
  });

  it('should block cross-tenant IDOR attack when Tenant B attempts to confirm Tenant A document', async () => {
    let tenantABidId = '';
    let tenantADocId = '';

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Railway Signalling Project',
          tenderNumber: 'RLY/SIG/2026/01',
          tenderingAuthority: 'Indian Railways',
          estimatedValueRupees: 30000000,
          submissionDeadline: futureDate,
        });
        tenantABidId = bid.id;

        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Signal_Specs.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });
        tenantADocId = upload.documentId;
      },
    );

    // Tenant B attempts to confirm Tenant A's document
    await TenantContextHolder.run(
      { organizationId: tenantB, userId: 'usr-competitor-hacker', role: 'BID_MANAGER' },
      async () => {
        await expect(
          bidsController.confirmDocumentUpload(tenantB, 'usr-competitor-hacker', tenantABidId, {
            documentId: tenantADocId,
          }),
        ).rejects.toThrow(EntityNotFoundException);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 3. RBAC Permission Checks & Role Escalation Defense
  // ---------------------------------------------------------------------------
  it('should deny bid creation to a VIEWER role', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: viewerUser, role: 'VIEWER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        await expect(
          bidsController.create(tenantA, viewerUser, {
            title: 'Unauthorized Bid Project',
            tenderNumber: 'UNAUTH/001',
            tenderingAuthority: 'CPWD',
            estimatedValueRupees: 1000000,
            submissionDeadline: futureDate,
          }),
        ).rejects.toThrow(UnauthorizedTenantAccessException);
      },
    );
  });

  it('should deny document upload URL generation to a VIEWER role', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: viewerUser, role: 'VIEWER' },
      async () => {
        await expect(
          bidsController.generateUploadUrl(tenantA, viewerUser, 'bid-arbitrary', {
            documentType: 'NIT',
            fileName: 'Test.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(UnauthorizedTenantAccessException);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 4. Domain Invariants & Validation
  // ---------------------------------------------------------------------------
  it('should reject bid creation if submission deadline is in the past', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await expect(
          bidsController.create(tenantA, bidManagerUser, {
            title: 'Past Deadline Bid',
            tenderNumber: 'PAST/2026/001',
            tenderingAuthority: 'CPWD',
            estimatedValueRupees: 1000000,
            submissionDeadline: pastDate,
          }),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  it('should reject document upload URL generation if file size exceeds 100MB limit', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Heavy Project',
          tenderNumber: 'HEAVY/001',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        await expect(
          bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
            documentType: 'NIT',
            fileName: 'Oversized_Drawing.pdf',
            sizeBytes: 150 * 1024 * 1024, // 150MB
            mimeType: 'application/pdf',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  it('should reject document upload URL generation if MIME type is unsupported', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Executable Reject Project',
          tenderNumber: 'EXE/001',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        await expect(
          bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
            documentType: 'NIT',
            fileName: 'malware.exe',
            sizeBytes: 1024,
            mimeType: 'application/x-msdownload',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  it('should reject duplicate document uploads with the identical SHA-256 checksum in the same bid', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Deduplication Project',
          tenderNumber: 'DEDUP/001',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        // First upload succeeds
        await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Original.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Exact duplicate upload fails
        await expect(
          bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
            documentType: 'NIT',
            fileName: 'Duplicate_Copy.pdf',
            sizeBytes: 5000,
            mimeType: 'application/pdf',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  it('should reject confirmation if S3 upload has not been completed by client', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Premature Confirm Project',
          tenderNumber: 'PREMATURE/001',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Unfinished.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Storage service does NOT simulate file existence (client never uploaded)
        await expect(
          bidsController.confirmDocumentUpload(tenantA, bidManagerUser, bid.id, {
            documentId: upload.documentId,
          }),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Document Download Authorization & Security Invariants
  // ---------------------------------------------------------------------------
  it('should block cross-tenant IDOR download attack when Tenant B attempts to retrieve Tenant A document', async () => {
    let tenantABidId = '';
    let tenantADocId = '';

    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Secret Tunnel Project',
          tenderNumber: 'TUNNEL/2026/01',
          tenderingAuthority: 'Border Roads Organisation',
          estimatedValueRupees: 90000000,
          submissionDeadline: futureDate,
        });
        tenantABidId = bid.id;

        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Tunnel_Drawings.pdf',
          sizeBytes: 10000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });
        tenantADocId = upload.documentId;

        storageService.simulateUploadedObject(upload.s3Key, 10000, validChecksum);
        await bidsController.confirmDocumentUpload(tenantA, bidManagerUser, bid.id, {
          documentId: upload.documentId,
        });
      },
    );

    // Tenant B attacker attempts to get download URL for Tenant A's document
    await TenantContextHolder.run(
      { organizationId: tenantB, userId: 'usr-competitor-hacker', role: 'BID_MANAGER' },
      async () => {
        await expect(
          bidsController.getDocumentDownloadUrl(
            tenantB,
            'usr-competitor-hacker',
            tenantABidId,
            tenantADocId,
          ),
        ).rejects.toThrow(EntityNotFoundException); // Anti-IDOR: Returns 404, never 403
      },
    );
  });

  it('should reject download URL generation if document is still in PENDING_UPLOAD status', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Pending Doc Project',
          tenderNumber: 'PENDING/2026/01',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Unconfirmed.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Attempting to download before confirmation
        await expect(
          bidsController.getDocumentDownloadUrl(tenantA, bidManagerUser, bid.id, upload.documentId),
        ).rejects.toThrow(ValidationException);
      },
    );
  });

  it('should neutralize path traversal in uploaded fileName and enforce safe S3 key namespace', async () => {
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Traversal Test Project',
          tenderNumber: 'TRAVERSAL/2026/01',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });

        // Attacker attempts path traversal in fileName
        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: '../../../../etc/passwd.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });

        // Verify S3 key does not contain directory traversal escape sequences
        expect(upload.s3Key).not.toContain('..');
        expect(upload.s3Key).toMatch(
          new RegExp(`^tenants/${tenantA}/bids/${bid.id}/[a-f0-9-]+/passwd\\.pdf$`),
        );
      },
    );
  });

  it('should allow VIEWER role to download verified documents (read-only) but reject upload requests', async () => {
    let bidId = '';
    let documentId = '';

    // Step 1: BID_MANAGER uploads and verifies document
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: bidManagerUser, role: 'BID_MANAGER' },
      async () => {
        const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const bid = await bidsController.create(tenantA, bidManagerUser, {
          title: 'Viewer Access Project',
          tenderNumber: 'VIEWER/2026/01',
          tenderingAuthority: 'CPWD',
          estimatedValueRupees: 1000000,
          submissionDeadline: futureDate,
        });
        bidId = bid.id;

        const upload = await bidsController.generateUploadUrl(tenantA, bidManagerUser, bid.id, {
          documentType: 'NIT',
          fileName: 'Standard_NIT.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          checksumSha256: validChecksum,
        });
        documentId = upload.documentId;

        storageService.simulateUploadedObject(upload.s3Key, 5000, validChecksum);
        await bidsController.confirmDocumentUpload(tenantA, bidManagerUser, bid.id, {
          documentId: upload.documentId,
        });
      },
    );

    // Step 2: VIEWER role in same tenant accesses the document (allowed read-only)
    await TenantContextHolder.run(
      { organizationId: tenantA, userId: viewerUser, role: 'VIEWER' },
      async () => {
        const download = await bidsController.getDocumentDownloadUrl(
          tenantA,
          viewerUser,
          bidId,
          documentId,
        );
        expect(download.downloadUrl).toContain('response-content-disposition=attachment');

        // VIEWER attempts upload -> blocked
        await expect(
          bidsController.generateUploadUrl(tenantA, viewerUser, bidId, {
            documentType: 'BOQ',
            fileName: 'Price_Schedule.xlsx',
            sizeBytes: 2000,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            checksumSha256: validChecksum,
          }),
        ).rejects.toThrow(UnauthorizedTenantAccessException);
      },
    );
  });
});
