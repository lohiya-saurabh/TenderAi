import { AuditLog } from '@/modules/audit/domain/entities/AuditLog.js';

export interface IAuditRepository {
  save(log: AuditLog): Promise<void>;
  findByEntity(organizationId: string, entityType: string, entityId: string): Promise<AuditLog[]>;
}
