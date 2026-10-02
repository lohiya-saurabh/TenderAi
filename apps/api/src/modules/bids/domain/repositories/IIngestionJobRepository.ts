import { IngestionJob } from '../entities/IngestionJob.js';

export interface IIngestionJobRepository {
  findById(id: string, organizationId: string): Promise<IngestionJob | null>;
  findByDocumentId(documentId: string, organizationId: string): Promise<IngestionJob | null>;
  save(job: IngestionJob): Promise<void>;
  update(job: IngestionJob): Promise<void>;
}
