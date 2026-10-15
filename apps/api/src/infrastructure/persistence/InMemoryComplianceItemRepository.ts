import { ConcurrencyConflictException } from '@/common/domain/DomainException.js';
import { ComplianceItem } from '@/modules/compliance/domain/entities/ComplianceItem.js';
import { IComplianceItemRepository } from '@/modules/compliance/domain/repositories/IComplianceItemRepository.js';

interface StoredComplianceRecord {
  item: ComplianceItem;
  persistedVersion: number;
}

export class InMemoryComplianceItemRepository implements IComplianceItemRepository {
  private readonly records = new Map<string, StoredComplianceRecord>();

  public async findById(id: string, organizationId: string): Promise<ComplianceItem | null> {
    const record = this.records.get(id);
    if (!record || record.item.organizationId !== organizationId) {
      return null;
    }
    return record.item;
  }

  public async findByBidId(bidId: string, organizationId: string): Promise<ComplianceItem[]> {
    const results: ComplianceItem[] = [];
    for (const record of this.records.values()) {
      if (record.item.bidId === bidId && record.item.organizationId === organizationId) {
        results.push(record.item);
      }
    }
    return results;
  }

  public async save(item: ComplianceItem): Promise<void> {
    this.records.set(item.id, {
      item,
      persistedVersion: item.version,
    });
  }

  public async saveBatch(items: ComplianceItem[]): Promise<void> {
    for (const item of items) {
      this.records.set(item.id, {
        item,
        persistedVersion: item.version,
      });
    }
  }

  public async update(item: ComplianceItem, expectedVersion: number): Promise<void> {
    const record = this.records.get(item.id);
    if (!record) {
      throw new ConcurrencyConflictException('ComplianceItem', item.id, expectedVersion, 0);
    }

    // Matches SQL: UPDATE compliance_items SET ... WHERE id = :id AND version = :expectedVersion
    if (record.persistedVersion !== expectedVersion) {
      throw new ConcurrencyConflictException(
        'ComplianceItem',
        item.id,
        expectedVersion,
        record.persistedVersion,
      );
    }

    this.records.set(item.id, {
      item,
      persistedVersion: item.version,
    });
  }

  public clear(): void {
    this.records.clear();
  }
}
