import { AuditLog } from '../domain/entities/AuditLog.js';
import { IAuditRepository } from '../domain/repositories/IAuditRepository.js';

export class InMemoryAuditRepository implements IAuditRepository {
  private readonly logs: AuditLog[] = [];

  public async save(log: AuditLog): Promise<void> {
    this.logs.push(log);
  }

  public async findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.logs.filter(
      (log) =>
        log.organizationId === organizationId &&
        log.entityType === entityType &&
        log.entityId === entityId,
    );
  }

  public getAll(): AuditLog[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs.length = 0;
  }
}
