import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { IAuditRepository } from '@/modules/audit/domain/repositories/IAuditRepository.js';
import { AuditLog as DomainAuditLog } from '@/modules/audit/domain/entities/AuditLog.js';

@Injectable()
export class AuditRepository implements IAuditRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listEvents(bidId: string, orgId?: string): Promise<schema.AuditLog[]> {
    return this.db
      .select()
      .from(schema.auditLogs)
      .where(
        orgId
          ? and(eq(schema.auditLogs.bidId, bidId), eq(schema.auditLogs.organizationId, orgId))
          : eq(schema.auditLogs.bidId, bidId),
      )
      .orderBy(desc(schema.auditLogs.timestamp));
  }

  public async createLog(entry: schema.NewAuditLog): Promise<void> {
    await this.db.insert(schema.auditLogs).values(entry);
  }

  // Domain repository port implementation
  public async save(log: DomainAuditLog): Promise<void> {
    await this.db.insert(schema.auditLogs).values({
      id: log.id,
      bidId: log.entityId,
      organizationId: log.organizationId,
      userId: log.userId,
      userName: 'Authorized User',
      eventType: log.action,
      aggregateType: log.entityType,
      aggregateId: log.entityId,
      payload: log.diff,
      timestamp: log.createdAt,
    });
  }

  public async findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<DomainAuditLog[]> {
    const rows = await this.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.organizationId, organizationId),
          eq(schema.auditLogs.aggregateType, entityType),
          eq(schema.auditLogs.aggregateId, entityId),
        ),
      )
      .orderBy(desc(schema.auditLogs.timestamp));

    return rows.map(
      (r) =>
        new DomainAuditLog({
          id: r.id,
          organizationId: r.organizationId,
          userId: r.userId,
          action: r.eventType,
          entityType: r.aggregateType,
          entityId: r.aggregateId,
          diff: (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) as Record<
            string,
            unknown
          >,
          createdAt: r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp),
        }),
    );
  }
}
