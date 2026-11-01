/**
 * AuditService — Read-only audit event listing from PostgreSQL.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { type DrizzleDb } from '@/common/database/database.module.js';
import type { DemoAuditEvent } from '@/seed/data.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { AuditRepository } from '@/modules/audit/audit.repository.js';

@Injectable()
export class AuditService {
  private readonly repository: AuditRepository;

  constructor(
    @Inject(AuditRepository)
    repositoryOrDb: AuditRepository | DrizzleDb | PGlite,
  ) {
    this.repository =
      repositoryOrDb instanceof AuditRepository
        ? repositoryOrDb
        : new AuditRepository(repositoryOrDb);
  }

  public async listEvents(bidId: string): Promise<DemoAuditEvent[]> {
    const orgId = TenantContextHolder.get()?.organizationId;
    const records = await this.repository.listEvents(bidId, orgId);

    return records.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      userId: row.userId,
      userName: row.userName,
      organizationId: row.organizationId,
      payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as Record<
        string,
        unknown
      >,
      timestamp:
        row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    }));
  }
}
