import { BidProject } from '@/modules/bids/domain/entities/BidProject.js';

export const BID_REPOSITORY_TOKEN = 'BID_REPOSITORY';

export interface IBidRepository {
  findById(id: string, organizationId: string): Promise<BidProject | null>;
  findAllByOrganization(organizationId: string): Promise<BidProject[]>;
  save(bid: BidProject): Promise<void>;
  update(bid: BidProject): Promise<void>;
}
