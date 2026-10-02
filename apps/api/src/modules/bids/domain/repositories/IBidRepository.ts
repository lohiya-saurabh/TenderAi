import { BidProject } from '../entities/BidProject.js';

export interface IBidRepository {
  findById(id: string, organizationId: string): Promise<BidProject | null>;
  save(bid: BidProject): Promise<void>;
  update(bid: BidProject): Promise<void>;
}
