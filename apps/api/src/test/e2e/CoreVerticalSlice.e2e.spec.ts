import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '../../common/database/IUnitOfWork.js';
import {
  ConcurrencyConflictException,
  UnauthorizedTenantAccessException,
} from '../../common/domain/DomainException.js';
import { InternalServiceGuard } from '../../common/security/InternalServiceGuard.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { InMemoryAuditRepository } from '../../modules/audit/infrastructure/InMemoryAuditRepository.js';
import { CreateBidUseCase } from '../../modules/bids/application/CreateBidUseCase.js';
import { BidsController } from '../../modules/bids/presentation/BidsController.js';
import { BulkIngestComplianceUseCase } from '../../modules/compliance/application/BulkIngestComplianceUseCase.js';
import { ListComplianceItemsUseCase } from '../../modules/compliance/application/ListComplianceItemsUseCase.js';
import { ReviewComplianceItemUseCase } from '../../modules/compliance/application/ReviewComplianceItemUseCase.js';
import { ComplianceController } from '../../modules/compliance/presentation/ComplianceController.js';
import { InternalWorkerController } from '../../modules/compliance/presentation/InternalWorkerController.js';
import { InMemoryBidRepository } from '../../infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryComplianceItemRepository } from '../../infrastructure/persistence/InMemoryComplianceItemRepository.js';

describe('E2E: Tender Ingestion & Compliance Review Core Vertical Slice', () => {
  let bidRepo: InMemoryBidRepository;
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let unitOfWork: DirectUnitOfWork;

  let bidsController: BidsController;
  let internalWorkerController: InternalWorkerController;
  let complianceController: ComplianceController;

  const organizationId = 'org-contractor-prime';
  const bidManagerUserId = 'usr-bid-manager-1';
  const workerSecretKey = 'tenderpulse-internal-secret-2026';

  beforeEach(() => {
    bidRepo = new InMemoryBidRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    unitOfWork = new DirectUnitOfWork();

    // Wire Bids Module
    const createBidUseCase = new CreateBidUseCase(bidRepo, auditRepo);
    bidsController = new BidsController(createBidUseCase);

    // Wire Compliance Module
    const bulkIngestUseCase = new BulkIngestComplianceUseCase(
      bidRepo,
      complianceRepo,
      auditRepo,
      unitOfWork,
    );
    const serviceGuard = new InternalServiceGuard(workerSecretKey);
    internalWorkerController = new InternalWorkerController(bulkIngestUseCase, serviceGuard);

    const listUseCase = new ListComplianceItemsUseCase(complianceRepo);
    const reviewUseCase = new ReviewComplianceItemUseCase(complianceRepo, auditRepo, unitOfWork);
    complianceController = new ComplianceController(listUseCase, reviewUseCase);
  });

  it('should execute the full end-to-end flow: Create Bid -> Worker Ingestion -> List Checklist -> Review with OCC -> Audit Trail', async () => {
    // -------------------------------------------------------------
    // Step 1: Contractor creates a new Bid Project
    // -------------------------------------------------------------
    const createdBid = await TenantContextHolder.run(
      { organizationId, userId: bidManagerUserId, role: 'BID_MANAGER' },
      () =>
        bidsController.create(organizationId, bidManagerUserId, {
          title: 'State Highway Road Widening Package 4',
          tenderNumber: 'SH-4/PWD/2026/102',
          tenderingAuthority: 'Maharashtra State PWD',
          estimatedValueRupees: 85000000, // ₹8.5 Crore
          submissionDeadline: '2026-11-15T15:00:00.000Z',
        }),
    );

    expect(createdBid.id).toBeDefined();
    expect(createdBid.status).toBe('DRAFT');
    expect(createdBid.version).toBe(1);
    expect(createdBid.estimatedValueFormatted).toContain('8,50,00,000');

    // -------------------------------------------------------------
    // Step 2: Python AI Worker calls internal bulk ingestion endpoint
    // -------------------------------------------------------------
    const workerResult = await internalWorkerController.ingestBatch(
      workerSecretKey,
      organizationId,
      createdBid.id,
      'worker-pod-07',
      {
        items: [
          {
            category: 'ANNEXURE_DECLARATION',
            title: 'Affidavit of Non-Blacklisting',
            description: 'Affidavit affirming contractor is not debarred by any govt agency.',
            executionRules: {
              stampPaperRequired: true,
              stampPaperDenominationInr: 100,
              notarizationRequired: true,
              udinRequired: false,
            },
            provenance: {
              sourceDocumentId: 'doc-nit-vol-1',
              sourceFileName: 'NIT_Volume_1.pdf',
              pageNumber: 38,
              clauseReference: 'Section 3, Clause 14.2(b)',
              verbatimQuote:
                'The bidder shall submit an affidavit on non-judicial stamp paper of minimum Rs. 100/- duly notarized...',
              confidenceScore: 0.99,
            },
          },
          {
            category: 'FINANCIAL_CRITERIA',
            title: 'CA Turnover Certificate with UDIN',
            description: 'Average annual turnover of ₹4.25 Cr over last 3 FYs.',
            executionRules: {
              stampPaperRequired: false,
              notarizationRequired: false,
              udinRequired: true,
            },
            provenance: {
              sourceDocumentId: 'doc-nit-vol-1',
              sourceFileName: 'NIT_Volume_1.pdf',
              pageNumber: 14,
              clauseReference: 'Section 2, Clause 4.1',
              verbatimQuote:
                'Turnover certificate must be issued by a practicing Chartered Accountant with an ICAI UDIN.',
              confidenceScore: 0.98,
            },
          },
        ],
      },
    );

    expect(workerResult.insertedCount).toBe(2);
    expect(workerResult.bidStatus).toBe('REVIEW_READY');

    // Verify bid status in repository transitioned to REVIEW_READY
    const bidAfterIngest = await bidRepo.findById(createdBid.id, organizationId);
    expect(bidAfterIngest?.status.value).toBe('REVIEW_READY');

    // -------------------------------------------------------------
    // Step 3: Human Bid Manager opens checklist on web UI
    // -------------------------------------------------------------
    const checklist = await complianceController.listItems(organizationId, createdBid.id);
    expect(checklist).toHaveLength(2);
    expect(checklist[0]?.title).toBe('Affidavit of Non-Blacklisting');
    expect(checklist[0]?.executionRules.stampPaperDenominationInr).toBe(100);
    expect(checklist[0]?.provenance.pageNumber).toBe(38);
    expect(checklist[0]?.status).toBe('PENDING');

    const firstItemId = checklist[0]!.id;
    const secondItemId = checklist[1]!.id;

    // -------------------------------------------------------------
    // Step 4: Bid Manager reviews Item #1 and marks it READY
    // -------------------------------------------------------------
    const reviewResult = await complianceController.reviewItem(
      organizationId,
      bidManagerUserId,
      createdBid.id,
      firstItemId,
      {
        status: 'READY',
        notes: 'Purchased ₹100 stamp paper from court; notarized on 1-Oct.',
        expectedVersion: 1,
      },
    );

    expect(reviewResult.status).toBe('READY');
    expect(reviewResult.version).toBe(2);
    expect(reviewResult.userNotes).toContain('Purchased ₹100 stamp paper');

    // -------------------------------------------------------------
    // Step 5: Concurrent edit conflict protection (OCC)
    // Another user tries to update Item #1 using the stale version 1
    // -------------------------------------------------------------
    await expect(
      complianceController.reviewItem(
        organizationId,
        'usr-other-manager',
        createdBid.id,
        firstItemId,
        {
          status: 'FLAGGED',
          notes: 'Attempting conflicting edit',
          expectedVersion: 1, // Stale version! Current is 2
        },
      ),
    ).rejects.toThrow(ConcurrencyConflictException);

    // -------------------------------------------------------------
    // Step 6: Bid Manager reviews Item #2 and marks it FLAGGED with note
    // -------------------------------------------------------------
    const flagResult = await complianceController.reviewItem(
      organizationId,
      bidManagerUserId,
      createdBid.id,
      secondItemId,
      {
        status: 'FLAGGED',
        notes: 'Sent to CA Sharma for UDIN generation; expected by tomorrow.',
        expectedVersion: 1,
      },
    );
    expect(flagResult.status).toBe('FLAGGED');
    expect(flagResult.version).toBe(2);

    // -------------------------------------------------------------
    // Step 7: Verify immutable Audit Logs
    // -------------------------------------------------------------
    const logs = auditRepo.getAll();
    expect(logs.length).toBeGreaterThanOrEqual(4);
    // Actions logged: CREATE_BID, BULK_INGEST_COMPLIANCE, REVIEW_COMPLIANCE_ITEM (x2)
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('CREATE_BID');
    expect(actions).toContain('BULK_INGEST_COMPLIANCE');
    expect(actions).toContain('REVIEW_COMPLIANCE_ITEM');
  });

  it('should block unauthorized internal worker access with invalid secret key', async () => {
    await expect(
      internalWorkerController.ingestBatch(
        'wrong-or-missing-key',
        organizationId,
        'bid-123',
        'worker-bad',
        { items: [] },
      ),
    ).rejects.toThrow(UnauthorizedTenantAccessException);
  });
});
