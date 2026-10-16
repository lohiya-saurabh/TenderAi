import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '@/common/database/IUnitOfWork.js';
import {
  EntityNotFoundException,
  InvalidProvenanceException,
} from '@/common/domain/DomainException.js';
import { InMemoryBidRepository } from '@/infrastructure/persistence/InMemoryBidRepository.js';
import { InMemoryComplianceItemRepository } from '@/infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { InMemoryAuditRepository } from '@/modules/audit/infrastructure/InMemoryAuditRepository.js';
import { BidProject } from '@/modules/bids/domain/entities/BidProject.js';
import { Money } from '@/modules/bids/domain/value-objects/Money.js';
import { BulkIngestComplianceUseCase } from '@/modules/compliance/application/BulkIngestComplianceUseCase.js';

describe('BulkIngestComplianceUseCase', () => {
  let bidRepo: InMemoryBidRepository;
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let unitOfWork: DirectUnitOfWork;
  let useCase: BulkIngestComplianceUseCase;

  const orgId = 'org-tenant-1';
  let bid: BidProject;

  beforeEach(async () => {
    bidRepo = new InMemoryBidRepository();
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    unitOfWork = new DirectUnitOfWork();

    useCase = new BulkIngestComplianceUseCase(bidRepo, complianceRepo, auditRepo, unitOfWork);

    bid = new BidProject({
      id: 'bid-test-1',
      organizationId: orgId,
      title: 'PWD Bridge Project',
      tenderNumber: 'PWD/BR/2026/09',
      tenderingAuthority: 'State PWD',
      estimatedValue: Money.fromRupees(12000000), // ₹1.2 Cr
      submissionDeadline: new Date('2026-11-30T15:00:00Z'),
    });
    bid.markQueued();
    bid.markProcessing();
    await bidRepo.save(bid);
  });

  it('should successfully ingest compliance items, transition bid to REVIEW_READY, and log audit', () => {
    const itemsInput = [
      {
        category: 'ANNEXURE_DECLARATION',
        title: 'Non-Blacklisting Affidavit',
        description: 'Mandatory affidavit on ₹100 stamp paper',
        executionRules: {
          stampPaperRequired: true,
          stampPaperDenominationInr: 100,
          notarizationRequired: true,
          udinRequired: false,
        },
        provenance: {
          sourceDocumentId: 'doc-1',
          sourceFileName: 'NIT_PWD_Bridge.pdf',
          pageNumber: 24,
          clauseReference: 'Clause 8.2',
          verbatimQuote:
            'The contractor must submit an affidavit on Rs. 100 non-judicial stamp paper...',
          confidenceScore: 0.99,
        },
      },
      {
        category: 'FINANCIAL_CRITERIA',
        title: 'CA Turnover Certificate with UDIN',
        description: 'Turnover certificate of at least ₹60 Lakhs',
        executionRules: {
          stampPaperRequired: false,
          notarizationRequired: false,
          udinRequired: true,
        },
        provenance: {
          sourceDocumentId: 'doc-1',
          sourceFileName: 'NIT_PWD_Bridge.pdf',
          pageNumber: 12,
          clauseReference: 'Clause 5.1(a)',
          verbatimQuote: 'Annual turnover certified by CA with valid UDIN is mandatory.',
          confidenceScore: 0.97,
        },
      },
    ];

    return useCase
      .execute({
        bidId: bid.id,
        organizationId: orgId,
        workerId: 'worker-python-01',
        items: itemsInput,
      })
      .then(async (result) => {
        expect(result.insertedCount).toBe(2);
        expect(result.bidStatus).toBe('REVIEW_READY');

        // Verify items in repository
        const savedItems = await complianceRepo.findByBidId(bid.id, orgId);
        expect(savedItems).toHaveLength(2);
        expect(savedItems[0]?.executionRules.stampPaperDenominationInr).toBe(100);
        expect(savedItems[1]?.executionRules.udinRequired).toBe(true);

        // Verify Bid state updated in repository
        const updatedBid = await bidRepo.findById(bid.id, orgId);
        expect(updatedBid?.status.value).toBe('REVIEW_READY');

        // Verify Audit Log
        const logs = auditRepo.getAll();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.action).toBe('BULK_INGEST_COMPLIANCE');
      });
  });

  it('should throw EntityNotFoundException if bid does not exist', () => {
    return expect(
      useCase.execute({
        bidId: 'non-existent-bid',
        organizationId: orgId,
        workerId: 'worker-01',
        items: [
          {
            category: 'ANNEXURE',
            title: 'Test',
            description: 'Test',
            executionRules: {
              stampPaperRequired: false,
              notarizationRequired: false,
              udinRequired: false,
            },
            provenance: {
              sourceDocumentId: 'doc-1',
              sourceFileName: 'test.pdf',
              pageNumber: 1,
              clauseReference: '1',
              verbatimQuote: 'test quote',
              confidenceScore: 0.9,
            },
          },
        ],
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should reject batch if any item has ungrounded provenance', () => {
    return expect(
      useCase.execute({
        bidId: bid.id,
        organizationId: orgId,
        workerId: 'worker-01',
        items: [
          {
            category: 'ANNEXURE',
            title: 'Test',
            description: 'Test',
            executionRules: {
              stampPaperRequired: false,
              notarizationRequired: false,
              udinRequired: false,
            },
            provenance: {
              sourceDocumentId: 'doc-1',
              sourceFileName: 'test.pdf',
              pageNumber: -1, // Invalid page number!
              clauseReference: '1',
              verbatimQuote: '', // Empty quote!
              confidenceScore: 0.9,
            },
          },
        ],
      }),
    ).rejects.toThrow(InvalidProvenanceException);
  });
});
