import { ComplianceItem } from '@/modules/compliance/domain/entities/ComplianceItem.js';

export interface IComplianceItemRepository {
  findById(id: string, organizationId: string): Promise<ComplianceItem | null>;
  findByBidId(bidId: string, organizationId: string): Promise<ComplianceItem[]>;
  save(item: ComplianceItem): Promise<void>;
  saveBatch(items: ComplianceItem[]): Promise<void>;
  update(item: ComplianceItem, expectedVersion: number): Promise<void>;
}
