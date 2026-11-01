/**
 * ChatQueries — Query object dedicated to context gathering for AI reasoning:
 * multi-table joins, tender chunks, compliance items, company evidence, and statutory profile data.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

export interface ChatTenderChunkContext {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  clauseReference: string | null;
  sectionTitle: string | null;
  content: string;
}

export interface ChatComplianceItemContext {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: string;
  executionRules: unknown;
  provenance: unknown;
}

export interface ChatEvidenceDocContext {
  documentId: string;
  documentName: string;
  evidenceType: string;
  issuer: string | null;
  referenceNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  verificationStatus: string;
  extractedAttributes: unknown;
}

export interface ChatEvidenceChunkContext {
  chunkId: string;
  documentId: string;
  documentName: string;
  evidenceType: string | null;
  chunkIndex: number;
  chunkType: string;
  content: string;
  pageNumber: number | null;
  clauseReference: string | null;
  metadata: unknown;
}

@Injectable()
export class ChatQueries {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async checkBidExists(bidId: string, orgId: string): Promise<boolean> {
    const [bid] = await this.db
      .select({ id: schema.bids.id })
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    return Boolean(bid);
  }

  async checkCompanyExists(companyId: string, orgId: string): Promise<boolean> {
    const [company] = await this.db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.id, companyId),
          eq(schema.companies.organizationId, orgId),
        ),
      )
      .limit(1);

    return Boolean(company);
  }

  async findTenderChunks(
    bidId: string,
    orgId: string,
    limit: number = 20,
  ): Promise<ChatTenderChunkContext[]> {
    const rawChunks = await this.db
      .select({
        id: schema.tenderDocumentChunks.id,
        documentId: schema.tenderDocumentChunks.documentId,
        documentName: schema.tenderDocuments.fileName,
        pageNumber: schema.tenderDocumentChunks.pageNumber,
        clauseReference: schema.tenderDocumentChunks.clauseReference,
        sectionTitle: schema.tenderDocumentChunks.sectionTitle,
        content: schema.tenderDocumentChunks.content,
      })
      .from(schema.tenderDocumentChunks)
      .leftJoin(
        schema.tenderDocuments,
        eq(schema.tenderDocumentChunks.documentId, schema.tenderDocuments.id),
      )
      .where(
        and(
          eq(schema.tenderDocumentChunks.bidId, bidId),
          eq(schema.tenderDocumentChunks.organizationId, orgId),
        ),
      )
      .limit(limit);

    return rawChunks.map((c) => ({
      chunkId: c.id,
      documentId: c.documentId,
      documentName: c.documentName ?? 'Tender_Document.pdf',
      pageNumber: c.pageNumber,
      clauseReference: c.clauseReference,
      sectionTitle: c.sectionTitle,
      content: c.content,
    }));
  }

  async findComplianceItems(
    bidId: string,
    orgId: string,
    limit: number = 25,
  ): Promise<ChatComplianceItemContext[]> {
    const items = await this.db
      .select()
      .from(schema.complianceItems)
      .where(
        and(
          eq(schema.complianceItems.bidId, bidId),
          eq(schema.complianceItems.organizationId, orgId),
        ),
      )
      .limit(limit);

    return items.map((i) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      description: i.description,
      status: i.status,
      executionRules: i.executionRules,
      provenance: i.provenance,
    }));
  }

  async findBidCompanyId(
    bidId: string,
    orgId: string,
  ): Promise<string | null> {
    const [bidRow] = await this.db
      .select({ companyId: schema.bids.companyId })
      .from(schema.bids)
      .where(and(eq(schema.bids.id, bidId), eq(schema.bids.organizationId, orgId)))
      .limit(1);

    return bidRow?.companyId ?? null;
  }

  async findDefaultCompanyId(orgId: string): Promise<string | null> {
    const [orgCompany] = await this.db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, orgId))
      .limit(1);

    return orgCompany?.id ?? null;
  }

  async findCompanyBasics(
    companyId: string,
    orgId: string,
  ): Promise<{
    id: string;
    legalName: string;
    gstin: string | null;
    pan: string | null;
    cin: string | null;
    udyamId: string | null;
    constitution: string | null;
    gstinVerifiedAt: Date | null;
  } | null> {
    const [companyRecord] = await this.db
      .select({
        id: schema.companies.id,
        legalName: schema.companies.legalName,
        gstin: schema.companies.gstin,
        pan: schema.companies.pan,
        cin: schema.companies.cin,
        udyamId: schema.companies.udyamId,
        constitution: schema.companies.constitution,
        gstinVerifiedAt: schema.companies.gstinVerifiedAt,
      })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.id, companyId),
          eq(schema.companies.organizationId, orgId),
        ),
      )
      .limit(1);

    return companyRecord ?? null;
  }

  async findActiveCompanyProfile(
    companyId: string,
    orgId: string,
  ): Promise<Record<string, unknown> | null> {
    const [activeProfile] = await this.db
      .select({ payload: schema.companyProfileVersions.payload })
      .from(schema.companyProfiles)
      .innerJoin(
        schema.companyProfileVersions,
        eq(schema.companyProfiles.activeVersionId, schema.companyProfileVersions.id),
      )
      .where(
        and(
          eq(schema.companyProfiles.companyId, companyId),
          eq(schema.companyProfiles.organizationId, orgId),
        ),
      )
      .limit(1);

    return (activeProfile?.payload as Record<string, unknown>) ?? null;
  }

  async findCompanyEvidenceDocs(
    companyId: string,
    orgId: string,
    limit: number = 20,
  ): Promise<ChatEvidenceDocContext[]> {
    const evidenceDocs = await this.db
      .select({
        id: schema.companyEvidenceDocuments.id,
        fileName: schema.companyEvidenceDocuments.fileName,
        evidenceType: schema.companyEvidenceDocuments.evidenceType,
        issuer: schema.companyEvidenceDocuments.issuer,
        referenceNumber: schema.companyEvidenceDocuments.referenceNumber,
        validFrom: schema.companyEvidenceDocuments.validFrom,
        validTo: schema.companyEvidenceDocuments.validTo,
        verificationStatus: schema.companyEvidenceDocuments.verificationStatus,
        extractedAttributes: schema.companyEvidenceDocuments.extractedAttributes,
      })
      .from(schema.companyEvidenceDocuments)
      .where(
        and(
          eq(schema.companyEvidenceDocuments.companyId, companyId),
          eq(schema.companyEvidenceDocuments.organizationId, orgId),
        ),
      )
      .limit(limit);

    return evidenceDocs.map((e) => ({
      documentId: e.id,
      documentName: e.fileName,
      evidenceType: e.evidenceType,
      issuer: e.issuer,
      referenceNumber: e.referenceNumber,
      validFrom: e.validFrom ? e.validFrom.toISOString() : null,
      validTo: e.validTo ? e.validTo.toISOString() : null,
      verificationStatus: e.verificationStatus,
      extractedAttributes: e.extractedAttributes,
    }));
  }

  async findCompanyEvidenceChunks(
    companyId: string,
    orgId: string,
    limit: number = 25,
  ): Promise<ChatEvidenceChunkContext[]> {
    const rawEvidenceChunks = await this.db
      .select({
        id: schema.companyEvidenceChunks.id,
        evidenceDocumentId: schema.companyEvidenceChunks.evidenceDocumentId,
        fileName: schema.companyEvidenceDocuments.fileName,
        evidenceType: schema.companyEvidenceDocuments.evidenceType,
        chunkIndex: schema.companyEvidenceChunks.chunkIndex,
        chunkType: schema.companyEvidenceChunks.chunkType,
        content: schema.companyEvidenceChunks.content,
        pageNumber: schema.companyEvidenceChunks.pageNumber,
        clauseReference: schema.companyEvidenceChunks.clauseReference,
        metadata: schema.companyEvidenceChunks.metadata,
      })
      .from(schema.companyEvidenceChunks)
      .leftJoin(
        schema.companyEvidenceDocuments,
        eq(schema.companyEvidenceChunks.evidenceDocumentId, schema.companyEvidenceDocuments.id),
      )
      .where(
        and(
          eq(schema.companyEvidenceChunks.companyId, companyId),
          eq(schema.companyEvidenceChunks.organizationId, orgId),
        ),
      )
      .limit(limit);

    return rawEvidenceChunks.map((c) => ({
      chunkId: c.id,
      documentId: c.evidenceDocumentId,
      documentName: c.fileName ?? 'Company_Evidence.pdf',
      evidenceType: c.evidenceType,
      chunkIndex: c.chunkIndex,
      chunkType: c.chunkType,
      content: c.content,
      pageNumber: c.pageNumber,
      clauseReference: c.clauseReference,
      metadata: c.metadata,
    }));
  }
}
