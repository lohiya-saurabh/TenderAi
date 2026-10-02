import { TenderDocument } from '../../modules/bids/domain/entities/TenderDocument.js';
import { ITenderDocumentRepository } from '../../modules/bids/domain/repositories/ITenderDocumentRepository.js';

export class InMemoryTenderDocumentRepository implements ITenderDocumentRepository {
  private readonly documents: Map<string, TenderDocument> = new Map();

  public async findById(id: string, organizationId: string): Promise<TenderDocument | null> {
    const doc = this.documents.get(id);
    if (!doc || doc.organizationId !== organizationId) {
      return null;
    }
    return doc;
  }

  public async findByBidId(bidId: string, organizationId: string): Promise<TenderDocument[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.bidId === bidId && doc.organizationId === organizationId
    );
  }

  public async findByChecksum(
    bidId: string,
    checksumSha256: string,
    organizationId: string
  ): Promise<TenderDocument | null> {
    const target = checksumSha256.toLowerCase();
    const doc = Array.from(this.documents.values()).find(
      (d) => d.bidId === bidId && d.organizationId === organizationId && d.checksumSha256 === target
    );
    return doc ?? null;
  }

  public async save(document: TenderDocument): Promise<void> {
    this.documents.set(document.id, document);
  }

  public async update(document: TenderDocument): Promise<void> {
    this.documents.set(document.id, document);
  }

  public clear(): void {
    this.documents.clear();
  }

  public getAll(): TenderDocument[] {
    return Array.from(this.documents.values());
  }
}
