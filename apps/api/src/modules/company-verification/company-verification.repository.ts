import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, desc, or } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class CompanyVerificationRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findCompany(companyId: string, orgId: string): Promise<schema.Company | null> {
    const [comp] = await this.db
      .select()
      .from(schema.companies)
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)))
      .limit(1);

    return comp ?? null;
  }

  public async insertEvidenceDocument(
    doc: schema.NewCompanyEvidenceDocument,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const [inserted] = await this.db
      .insert(schema.companyEvidenceDocuments)
      .values(doc)
      .returning();

    return inserted ?? null;
  }

  public async listEvidenceDocuments(
    companyId: string,
    orgId: string,
    evidenceType?: string,
  ): Promise<schema.CompanyEvidenceDocument[]> {
    const conditions = [
      eq(schema.companyEvidenceDocuments.organizationId, orgId),
      eq(schema.companyEvidenceDocuments.companyId, companyId),
    ];
    if (evidenceType) {
      conditions.push(eq(schema.companyEvidenceDocuments.evidenceType, evidenceType));
    }

    return this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(and(...conditions))
      .orderBy(desc(schema.companyEvidenceDocuments.createdAt));
  }

  public async findEvidenceDocument(
    documentIdOrName: string,
    companyId: string,
    orgId: string,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const [doc] = await this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          or(
            eq(schema.companyEvidenceDocuments.id, documentIdOrName),
            eq(schema.companyEvidenceDocuments.fileName, documentIdOrName),
          ),
          eq(schema.companyEvidenceDocuments.companyId, companyId),
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    return doc ?? null;
  }

  public async findEvidenceDocumentById(
    documentId: string,
    orgId: string,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const [doc] = await this.db
      .select()
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.id, documentId),
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
        ),
      )
      .limit(1);

    return doc ?? null;
  }

  public async deleteEvidenceDocument(
    documentId: string,
    orgId?: string,
  ): Promise<void> {
    const conditions = [eq(schema.companyEvidenceDocuments.id, documentId)];
    if (orgId) {
      conditions.push(eq(schema.companyEvidenceDocuments.organizationId, orgId));
    }
    await this.db
      .delete(schema.companyEvidenceDocuments)
      .where(and(...conditions));
  }

  public async updateEvidenceDocument(
    documentId: string,
    orgId: string,
    updates: Partial<schema.NewCompanyEvidenceDocument>,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const [updated] = await this.db
      .update(schema.companyEvidenceDocuments)
      .set(updates)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.id, documentId),
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
        ),
      )
      .returning();

    return updated ?? null;
  }

  public async updateEvidenceDocumentVerification(
    documentId: string,
    updates: Partial<schema.NewCompanyEvidenceDocument>,
    orgId?: string,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const conditions = [eq(schema.companyEvidenceDocuments.id, documentId)];
    if (orgId) {
      conditions.push(eq(schema.companyEvidenceDocuments.organizationId, orgId));
    }
    const [updated] = await this.db
      .update(schema.companyEvidenceDocuments)
      .set(updates)
      .where(and(...conditions))
      .returning();

    return updated ?? null;
  }

  public async updateEvidenceDocumentById(
    documentId: string,
    updates: Partial<schema.NewCompanyEvidenceDocument>,
  ): Promise<schema.CompanyEvidenceDocument | null> {
    const [updated] = await this.db
      .update(schema.companyEvidenceDocuments)
      .set(updates)
      .where(eq(schema.companyEvidenceDocuments.id, documentId))
      .returning();

    return updated ?? null;
  }

  public async deleteEvidenceChunks(documentId: string, orgId: string): Promise<void> {
    await this.db
      .delete(schema.companyEvidenceChunks)
      .where(
        and(
          eq(schema.companyEvidenceChunks.evidenceDocumentId, documentId),
          eq(schema.companyEvidenceChunks.organizationId, orgId),
        ),
      );
  }

  public async insertEvidenceChunks(chunks: schema.NewCompanyEvidenceChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.db.insert(schema.companyEvidenceChunks).values(chunk);
    }
  }

  public async updateCompany(
    companyId: string,
    updates: Partial<schema.NewCompany>,
  ): Promise<void> {
    await this.db
      .update(schema.companies)
      .set(updates)
      .where(eq(schema.companies.id, companyId));
  }

  public async updateCompanyMcaVerification(
    companyId: string,
    orgId: string,
    mcaVerifiedAt: Date,
    mcaVerificationData: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(schema.companies)
      .set({
        mcaVerifiedAt,
        mcaVerificationData,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)));
  }

  public async updateCompanyUdyamVerification(
    companyId: string,
    orgId: string,
    udyamVerifiedAt: Date,
    udyamVerificationData: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(schema.companies)
      .set({
        udyamVerifiedAt,
        udyamVerificationData,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)));
  }

  public async updateCompanyDigiLocker(
    companyId: string,
    orgId: string,
    digilockerLinkedAt: Date,
    digilockerMetadata: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(schema.companies)
      .set({
        digilockerLinkedAt,
        digilockerMetadata,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.companies.id, companyId), eq(schema.companies.organizationId, orgId)));
  }

  public async listVerificationHistory(
    companyId: string,
    orgId: string,
    documentId?: string,
  ): Promise<schema.EvidenceVerificationHistoryRecord[]> {
    const conditions = [
      eq(schema.evidenceVerificationHistory.organizationId, orgId),
      eq(schema.evidenceVerificationHistory.companyId, companyId),
    ];
    if (documentId) {
      conditions.push(eq(schema.evidenceVerificationHistory.evidenceDocumentId, documentId));
    }

    return this.db
      .select()
      .from(schema.evidenceVerificationHistory)
      .where(and(...conditions))
      .orderBy(desc(schema.evidenceVerificationHistory.timestamp));
  }

  public async insertVerificationHistory(
    record: schema.NewEvidenceVerificationHistoryRecord,
  ): Promise<void> {
    await this.db.insert(schema.evidenceVerificationHistory).values(record);
  }
}
