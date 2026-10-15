import { IngestionJob } from '@/modules/bids/domain/entities/IngestionJob.js';
import { IIngestionJobRepository } from '@/modules/bids/domain/repositories/IIngestionJobRepository.js';

export class InMemoryIngestionJobRepository implements IIngestionJobRepository {
  private readonly jobs: Map<string, IngestionJob> = new Map();

  public async findById(id: string, organizationId: string): Promise<IngestionJob | null> {
    const job = this.jobs.get(id);
    if (!job || job.organizationId !== organizationId) {
      return null;
    }
    return job;
  }

  public async findByDocumentId(
    documentId: string,
    organizationId: string,
  ): Promise<IngestionJob | null> {
    const job = Array.from(this.jobs.values()).find(
      (j) => j.documentId === documentId && j.organizationId === organizationId,
    );
    return job ?? null;
  }

  public async save(job: IngestionJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  public async update(job: IngestionJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  public clear(): void {
    this.jobs.clear();
  }

  public getAll(): IngestionJob[] {
    return Array.from(this.jobs.values());
  }
}
