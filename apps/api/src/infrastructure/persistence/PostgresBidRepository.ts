/**
 * PostgresBidRepository — PostgreSQL implementation of the IBidRepository domain port.
 *
 * Enforces:
 * 1. Strict tenant boundary filtering (Anti-IDOR) on every query.
 * 2. Domain aggregate reconstitution with Value Objects (Money, BidStatus).
 * 3. Optimistic Concurrency Control (OCC) using atomic version updates.
 * 4. Automatic dispatch of uncommitted domain events upon persistence.
 */
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import { IBidRepository } from '@/modules/bids/domain/repositories/IBidRepository.js';
import { BidProject } from '@/modules/bids/domain/entities/BidProject.js';
import { BidStatus } from '@/modules/bids/domain/value-objects/BidStatus.js';
import { Money } from '@/modules/bids/domain/value-objects/Money.js';
import { ConcurrencyConflictException } from '@/common/domain/DomainException.js';
import { IEventBus } from '@/common/events/IEventBus.js';
import { createDrizzle, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

export class PostgresBidRepository implements IBidRepository {
  private readonly db: DrizzleDb;

  constructor(
    db: DrizzleDb | PGlite,
    private readonly eventBus?: IEventBus,
  ) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findById(id: string, organizationId: string): Promise<BidProject | null> {
    const [row] = await this.db
      .select()
      .from(schema.bids)
      .where(and(eq(schema.bids.id, id), eq(schema.bids.organizationId, organizationId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.mapToAggregate(row);
  }

  public async findAllByOrganization(organizationId: string): Promise<BidProject[]> {
    const rows = await this.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, organizationId))
      .orderBy(desc(schema.bids.createdAt));

    return rows.map((row) => this.mapToAggregate(row));
  }

  public async save(bid: BidProject): Promise<void> {
    const now = new Date();
    await this.db
      .insert(schema.bids)
      .values({
        id: bid.id,
        organizationId: bid.organizationId,
        companyId: bid.companyId,
        title: bid.title,
        tenderNumber: bid.tenderNumber,
        tenderingAuthority: bid.tenderingAuthority,
        estimatedValueRupees: bid.estimatedValue.toRupees(),
        submissionDeadline: bid.submissionDeadline.toISOString(),
        status: bid.status.value,
        version: bid.version,
        createdAt: bid.createdAt,
        updatedAt: now,
      })
      .onConflictDoNothing();

    await this.dispatchDomainEvents(bid);
  }

  public async update(bid: BidProject): Promise<void> {
    const now = new Date();
    const expectedCurrentVersion = bid.version - 1;

    const res = await this.db
      .update(schema.bids)
      .set({
        title: bid.title,
        tenderNumber: bid.tenderNumber,
        tenderingAuthority: bid.tenderingAuthority,
        estimatedValueRupees: bid.estimatedValue.toRupees(),
        submissionDeadline: bid.submissionDeadline.toISOString(),
        status: bid.status.value,
        version: bid.version,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.bids.id, bid.id),
          eq(schema.bids.organizationId, bid.organizationId),
          eq(schema.bids.version, expectedCurrentVersion),
        ),
      )
      .returning({ id: schema.bids.id });

    if (res.length === 0) {
      throw new ConcurrencyConflictException(
        'BidProject',
        bid.id,
        bid.version,
        expectedCurrentVersion,
      );
    }

    await this.dispatchDomainEvents(bid);
  }

  private mapToAggregate(row: schema.Bid): BidProject {
    return new BidProject({
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      tenderNumber: row.tenderNumber,
      tenderingAuthority: row.tenderingAuthority,
      estimatedValue: Money.fromRupees(Number(row.estimatedValueRupees)),
      submissionDeadline: row.submissionDeadline ? new Date(row.submissionDeadline) : new Date(),
      status: BidStatus.fromString(row.status),
      version: Number(row.version),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    });
  }

  private async dispatchDomainEvents(aggregate: BidProject): Promise<void> {
    const events = aggregate.pullDomainEvents();
    if (this.eventBus && events.length > 0) {
      for (const event of events) {
        await this.eventBus.publish(event);
      }
    }
  }
}
