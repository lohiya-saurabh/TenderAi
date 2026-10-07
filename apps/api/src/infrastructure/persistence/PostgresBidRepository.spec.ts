import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PostgresBidRepository } from './PostgresBidRepository.js';
import { initDatabase } from '../../common/database/database.provider.js';
import { BidProject } from '../../modules/bids/domain/entities/BidProject.js';
import { Money } from '../../modules/bids/domain/value-objects/Money.js';
import { BidStatus } from '../../modules/bids/domain/value-objects/BidStatus.js';
import { ConcurrencyConflictException } from '../../common/domain/DomainException.js';
import { InMemoryEventBus } from '../../common/events/InMemoryEventBus.js';

describe('Infrastructure: PostgresBidRepository Unit & Integration Tests', () => {
  let db: PGlite;
  let repo: PostgresBidRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    eventBus = new InMemoryEventBus();
    repo = new PostgresBidRepository(db, eventBus);
  });

  const createSampleBid = (id: string, orgId = 'org_acme_infra_001') => {
    return new BidProject({
      id,
      organizationId: orgId,
      title: 'Construction of NH-48 Flyover Section',
      tenderNumber: 'NHAI/2026/FL-01',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValue: Money.fromRupees(150000000),
      submissionDeadline: new Date('2026-12-31T18:00:00.000Z'),
    });
  };

  it('should save a BidProject aggregate root and retrieve it with value objects preserved', async () => {
    const bid = createSampleBid('bid-repo-test-01');
    await repo.save(bid);

    const retrieved = await repo.findById('bid-repo-test-01', 'org_acme_infra_001');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('bid-repo-test-01');
    expect(retrieved!.organizationId).toBe('org_acme_infra_001');
    expect(retrieved!.title).toBe('Construction of NH-48 Flyover Section');
    expect(retrieved!.tenderNumber).toBe('NHAI/2026/FL-01');
    expect(retrieved!.tenderingAuthority).toBe('National Highways Authority of India');
    expect(retrieved!.estimatedValue.toRupees()).toBe(150000000);
    expect(retrieved!.status.value).toBe(BidStatus.DRAFT.value);
    expect(retrieved!.version).toBe(1);
  });

  it('should strictly enforce tenant boundary anti-IDOR checks on findById', async () => {
    const bid = createSampleBid('bid-tenant-test-01', 'org_acme_infra_001');
    await repo.save(bid);

    // Attempt to access bid from another tenant organization
    const unauthorizedAccess = await repo.findById('bid-tenant-test-01', 'org_rival_infra_999');
    expect(unauthorizedAccess).toBeNull();
  });

  it('should list all bids for a specific organization and ignore other organizations', async () => {
    const bid1 = createSampleBid('bid-org-01', 'org_acme_infra_001');
    const bid2 = createSampleBid('bid-org-02', 'org_acme_infra_001');
    const foreignBid = createSampleBid('bid-org-foreign', 'org_different_corp_002');

    await repo.save(bid1);
    await repo.save(bid2);
    await repo.save(foreignBid);

    const acmeBids = await repo.findAllByOrganization('org_acme_infra_001');
    expect(acmeBids.some((b) => b.id === 'bid-org-01')).toBe(true);
    expect(acmeBids.some((b) => b.id === 'bid-org-02')).toBe(true);
    expect(acmeBids.some((b) => b.id === 'bid-org-foreign')).toBe(false);
  });

  it('should persist state transitions and enforce optimistic concurrency control', async () => {
    const bid = createSampleBid('bid-occ-test-01');
    await repo.save(bid);

    // Transition state DRAFT -> QUEUED (increments version 1 -> 2)
    bid.markQueued();
    expect(bid.version).toBe(2);
    await repo.update(bid);

    const reloaded = await repo.findById('bid-occ-test-01', 'org_acme_infra_001');
    expect(reloaded!.status.value).toBe(BidStatus.QUEUED.value);
    expect(reloaded!.version).toBe(2);
  });

  it('should throw ConcurrencyConflictException when updating with a stale version', async () => {
    const bid = createSampleBid('bid-conflict-test-01');
    await repo.save(bid);

    // First transition and save (V1 -> V2)
    bid.markQueued();
    await repo.update(bid);

    // Simulate another concurrent process attempting to update based on stale V1
    const staleBid = new BidProject({
      id: 'bid-conflict-test-01',
      organizationId: 'org_acme_infra_001',
      title: 'Conflict Title',
      tenderNumber: 'NHAI/2026/FL-01',
      tenderingAuthority: 'National Highways Authority of India',
      estimatedValue: Money.fromRupees(150000000),
      submissionDeadline: new Date('2026-12-31T18:00:00.000Z'),
      status: BidStatus.QUEUED,
      version: 2, // Expects DB to be at V1, but DB is already at V2
    });

    await expect(repo.update(staleBid)).rejects.toThrow(ConcurrencyConflictException);
  });

  it('should automatically publish domain events on aggregate persistence', async () => {
    const publishedEvents: string[] = [];
    eventBus.subscribe('tenderpulse.bids.project-created.v1', async (e) => {
      publishedEvents.push(e.eventType);
    });

    const bid = createSampleBid('bid-events-test-01');
    expect(bid.domainEvents.length).toBe(1);

    await repo.save(bid);

    expect(publishedEvents).toContain('tenderpulse.bids.project-created.v1');
    expect(bid.domainEvents.length).toBe(0); // events cleared after dispatch
  });
});
