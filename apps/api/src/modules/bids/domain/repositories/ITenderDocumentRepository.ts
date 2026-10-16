import { TenderDocument } from '@/modules/bids/domain/entities/TenderDocument.js';

export interface ITenderDocumentRepository {
  findById(id: string, organizationId: string): Promise<TenderDocument | null>;
  findByBidId(bidId: string, organizationId: string): Promise<TenderDocument[]>;
  findByChecksum(
    bidId: string,
    checksumSha256: string,
    organizationId: string,
  ): Promise<TenderDocument | null>;
  save(document: TenderDocument): Promise<void>;
  update(document: TenderDocument): Promise<void>;
}
