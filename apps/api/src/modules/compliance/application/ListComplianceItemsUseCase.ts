import { IComplianceItemRepository } from '../domain/repositories/IComplianceItemRepository.js';
import { ExecutionRulesProps } from '../domain/value-objects/ExecutionRules.js';
import { ProvenanceProps } from '../domain/value-objects/Provenance.js';

export interface ListComplianceItemsQuery {
  organizationId: string;
  bidId: string;
}

export interface ComplianceItemViewDto {
  id: string;
  bidId: string;
  category: string;
  title: string;
  description: string;
  executionRules: ExecutionRulesProps;
  provenance: ProvenanceProps;
  status: string;
  userNotes: string | null;
  assignedUserId: string | null;
  version: number;
  reviewedAt: string | null;
  createdAt: string;
}

export class ListComplianceItemsUseCase {
  constructor(private readonly complianceRepository: IComplianceItemRepository) {}

  public async execute(query: ListComplianceItemsQuery): Promise<ComplianceItemViewDto[]> {
    const items = await this.complianceRepository.findByBidId(query.bidId, query.organizationId);

    return items.map((item) => ({
      id: item.id,
      bidId: item.bidId,
      category: item.category,
      title: item.title,
      description: item.description,
      executionRules: item.executionRules.toJSON(),
      provenance: item.provenance.toJSON(),
      status: item.status.value,
      userNotes: item.userNotes,
      assignedUserId: item.assignedUserId,
      version: item.version,
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    }));
  }
}
