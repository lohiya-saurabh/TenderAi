import { ConcurrencyConflictException } from '../../common/domain/DomainException.js';
import { BidProject } from '../../modules/bids/domain/entities/BidProject.js';
import { IBidRepository } from '../../modules/bids/domain/repositories/IBidRepository.js';

export class InMemoryBidRepository implements IBidRepository {
  private readonly bids = new Map<string, BidProject>();

  public async findById(id: string, organizationId: string): Promise<BidProject | null> {
    const bid = this.bids.get(id);
    if (!bid || bid.organizationId !== organizationId) {
      return null;
    }
    return bid;
  }

  public async save(bid: BidProject): Promise<void> {
    this.bids.set(bid.id, bid);
  }

  public async update(bid: BidProject): Promise<void> {
    const existing = this.bids.get(bid.id);
    if (!existing || existing.organizationId !== bid.organizationId) {
      throw new ConcurrencyConflictException('BidProject', bid.id, bid.version, 0);
    }
    this.bids.set(bid.id, bid);
  }

  public clear(): void {
    this.bids.clear();
  }
}
