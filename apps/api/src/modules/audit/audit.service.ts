/**
 * AuditService — Read-only audit event listing from PostgreSQL.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb, createDrizzle } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import type { DemoAuditEvent } from '../../seed/data.js';

@Injectable()
export class AuditService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async listEvents(bidId: string): Promise<DemoAuditEvent[]> {
    const records = await this.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.bidId, bidId))
      .orderBy(desc(schema.auditLogs.timestamp));

    return records.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      userId: row.userId,
      userName: row.userName,
      organizationId: row.organizationId,
      payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as Record<string, unknown>,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    }));
  }
}
