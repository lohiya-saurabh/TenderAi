import { describe, it, expect, beforeEach } from 'vitest';
import { DirectUnitOfWork } from '../../../common/database/IUnitOfWork.js';
import {
  ConcurrencyConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../../common/domain/DomainException.js';
import { InMemoryComplianceItemRepository } from '../../../infrastructure/persistence/InMemoryComplianceItemRepository.js';
import { InMemoryAuditRepository } from '../../audit/infrastructure/InMemoryAuditRepository.js';
import { ComplianceItem } from '../domain/entities/ComplianceItem.js';
import { ExecutionRules } from '../domain/value-objects/ExecutionRules.js';
import { Provenance } from '../domain/value-objects/Provenance.js';
import { ReviewComplianceItemUseCase } from './ReviewComplianceItemUseCase.js';

describe('ReviewComplianceItemUseCase', () => {
  let complianceRepo: InMemoryComplianceItemRepository;
  let auditRepo: InMemoryAuditRepository;
  let unitOfWork: DirectUnitOfWork;
  let useCase: ReviewComplianceItemUseCase;

  const orgId = 'org-tenant-1';
  const bidId = 'bid-100';
  let item: ComplianceItem;

  beforeEach(async () => {
    complianceRepo = new InMemoryComplianceItemRepository();
    auditRepo = new InMemoryAuditRepository();
    unitOfWork = new DirectUnitOfWork();

    useCase = new ReviewComplianceItemUseCase(complianceRepo, auditRepo, unitOfWork);

    item = new ComplianceItem({
      id: 'item-101',
      bidId,
      organizationId: orgId,
      category: 'ANNEXURE_DECLARATION',
      title: 'Affidavit of Non-Blacklisting',
      description: '₹100 stamp paper required',
      executionRules: new ExecutionRules({
        stampPaperRequired: true,
        stampPaperDenominationInr: 100,
        notarizationRequired: true,
        udinRequired: false,
      }),
      provenance: new Provenance({
        sourceDocumentId: 'doc-1',
        sourceFileName: 'NIT.pdf',
        pageNumber: 15,
        clauseReference: 'Clause 7',
        verbatimQuote: 'Affidavit on Rs. 100 stamp paper.',
        confidenceScore: 0.99,
      }),
    });

    await complianceRepo.save(item);
  });

  it('should successfully update review status to READY, increment version, and write audit log', async () => {
    const result = await useCase.execute({
      organizationId: orgId,
      userId: 'usr-bid-manager',
      bidId,
      itemId: item.id,
      status: 'READY',
      notes: 'Stamp paper purchased and verified.',
      expectedVersion: 1,
    });

    expect(result.status).toBe('READY');
    expect(result.version).toBe(2);
    expect(result.userNotes).toBe('Stamp paper purchased and verified.');
    expect(result.reviewedAt).not.toBeNull();

    const updated = await complianceRepo.findById(item.id, orgId);
    expect(updated?.version).toBe(2);
    expect(updated?.status.value).toBe('READY');

    const logs = auditRepo.getAll();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('REVIEW_COMPLIANCE_ITEM');
  });

  it('should throw ConcurrencyConflictException when expectedVersion does not match current version', async () => {
    // First update succeeds (version becomes 2)
    await useCase.execute({
      organizationId: orgId,
      userId: 'usr-1',
      bidId,
      itemId: item.id,
      status: 'READY',
      expectedVersion: 1,
    });

    // Concurrent/stale update attempting to write with version 1 must be rejected!
    await expect(
      useCase.execute({
        organizationId: orgId,
        userId: 'usr-2',
        bidId,
        itemId: item.id,
        status: 'FLAGGED',
        notes: 'Trying to flag',
        expectedVersion: 1, // Stale version!
      })
    ).rejects.toThrow(ConcurrencyConflictException);
  });

  it('should reject access and throw EntityNotFoundException if requested under a different organizationId', async () => {
    await expect(
      useCase.execute({
        organizationId: 'other-rival-tenant-org',
        userId: 'usr-attacker',
        bidId,
        itemId: item.id,
        status: 'READY',
        expectedVersion: 1,
      })
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw ValidationException when status is FLAGGED without notes', async () => {
    await expect(
      useCase.execute({
        organizationId: orgId,
        userId: 'usr-1',
        bidId,
        itemId: item.id,
        status: 'FLAGGED',
        notes: '', // Empty notes!
        expectedVersion: 1,
      })
    ).rejects.toThrow(ValidationException);
  });
});
