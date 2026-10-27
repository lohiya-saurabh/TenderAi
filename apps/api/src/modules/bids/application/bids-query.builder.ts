import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import type { DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import type { DemoBid, DemoDocument } from '@/seed/data.js';
import type { IStorageService } from '@/modules/bids/application/IStorageService.js';

export interface ListBidsQuery {
  companyId?: string;
  page?: string | number;
  limit?: string | number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
  search?: string;
}

export interface BidDecisionProjection {
  decisionId: string;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
  state: 'AI_PROPOSED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';
  readinessScore: number;
  evaluatedAt: string;
}

export interface BidWithDecision extends DemoBid {
  decision?: BidDecisionProjection | null;
}

export interface PaginatedBidsResult {
  items: BidWithDecision[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function mapBidRecord(b: schema.Bid, documents: DemoDocument[]): DemoBid {
  return {
    id: b.id,
    companyId: b.companyId,
    title: b.title,
    tenderNumber: b.tenderNumber,
    tenderingAuthority: b.tenderingAuthority,
    estimatedValueRupees: Number(b.estimatedValueRupees),
    submissionDeadline: b.submissionDeadline,
    locationState: b.locationState,
    status: b.status,
    totalRequirements: b.totalRequirements,
    flaggedRequirements: b.flaggedRequirements,
    approvedRequirements: b.approvedRequirements,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
    documents,
  };
}

export async function fetchBidsWithRelations(
  db: DrizzleDb,
  orgId: string,
  query?: ListBidsQuery,
): Promise<PaginatedBidsResult | BidWithDecision[]> {
  if (!orgId) {
    if (query?.page && query?.limit) {
      return {
        items: [] as BidWithDecision[],
        total: 0,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
        totalPages: 0,
      };
    }
    return [];
  }

  // 1. Build SQL WHERE conditions
  const conditions = [eq(schema.bids.organizationId, orgId)];

  if (query?.companyId && typeof query.companyId === 'string' && query.companyId.trim()) {
    conditions.push(eq(schema.bids.companyId, query.companyId.trim()));
  }

  if (
    query?.status &&
    typeof query.status === 'string' &&
    query.status.trim() &&
    query.status !== 'ALL'
  ) {
    conditions.push(eq(schema.bids.status, query.status.trim().toUpperCase()));
  }

  if (query?.search && typeof query.search === 'string' && query.search.trim()) {
    const q = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${schema.bids.title}) LIKE ${q} OR LOWER(${schema.bids.tenderNumber}) LIKE ${q} OR LOWER(${schema.bids.tenderingAuthority}) LIKE ${q} OR LOWER(COALESCE(${schema.bids.locationState}, '')) LIKE ${q})`,
    );
  }

  // 2. Build SQL ORDER BY expression
  const sortField = query?.sort || 'createdAt';
  const isAsc = query?.order === 'asc';

  let orderExpr = isAsc ? asc(schema.bids.createdAt) : desc(schema.bids.createdAt);
  if (sortField === 'title') {
    orderExpr = isAsc ? asc(schema.bids.title) : desc(schema.bids.title);
  } else if (sortField === 'estimatedValueRupees') {
    orderExpr = isAsc ? asc(schema.bids.estimatedValueRupees) : desc(schema.bids.estimatedValueRupees);
  } else if (sortField === 'submissionDeadline') {
    orderExpr = isAsc ? asc(schema.bids.submissionDeadline) : desc(schema.bids.submissionDeadline);
  }

  // 3. Compute count in SQL
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.bids)
    .where(and(...conditions));
  const total = countRow?.count ?? 0;

  // 4. Compute pagination parameters
  const isPaginated = query?.page !== undefined || query?.limit !== undefined;
  const page = Math.max(
    1,
    typeof query?.page === 'number' ? query.page : parseInt(String(query?.page || 1), 10) || 1,
  );
  const limit = Math.max(
    1,
    typeof query?.limit === 'number'
      ? query.limit
      : parseInt(String(query?.limit || 10), 10) || 10,
  );
  const totalPages = Math.ceil(total / limit) || 1;

  // 5. Query the requested slice of bids using SQL LIMIT / OFFSET
  const baseQuery = db
    .select()
    .from(schema.bids)
    .where(and(...conditions))
    .orderBy(orderExpr);

  const pageBids = isPaginated
    ? await baseQuery.limit(limit).offset((page - 1) * limit)
    : await baseQuery;

  const bidIds = pageBids.map((b) => b.id);

  const allDocs =
    bidIds.length > 0
      ? await db
          .select()
          .from(schema.tenderDocuments)
          .where(
            and(
              eq(schema.tenderDocuments.organizationId, orgId),
              inArray(schema.tenderDocuments.bidId, bidIds),
            ),
          )
      : [];

  const docsByBid = new Map<string, DemoDocument[]>();
  for (const doc of allDocs) {
    if (!docsByBid.has(doc.bidId)) {
      docsByBid.set(doc.bidId, []);
    }
    docsByBid.get(doc.bidId)!.push({
      id: doc.id,
      fileName: doc.fileName,
      fileSizeBytes: Number(doc.fileSizeBytes),
      mimeType: doc.mimeType,
      documentType: doc.documentType,
      status: doc.status,
      uploadedAt:
        doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : String(doc.uploadedAt),
    });
  }

  const allDecisions =
    bidIds.length > 0
      ? await db
          .select()
          .from(schema.bidDecisions)
          .where(
            and(
              eq(schema.bidDecisions.organizationId, orgId),
              inArray(schema.bidDecisions.bidId, bidIds),
            ),
          )
          .orderBy(desc(schema.bidDecisions.createdAt))
      : [];

  const decisionByBid = new Map<string, BidDecisionProjection>();
  for (const d of allDecisions) {
    if (!decisionByBid.has(d.bidId)) {
      decisionByBid.set(d.bidId, {
        decisionId: d.id,
        verdict: d.verdict as BidDecisionProjection['verdict'],
        state: d.state as BidDecisionProjection['state'],
        readinessScore: Number(d.readinessScore),
        evaluatedAt:
          d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      });
    }
  }

  const items: BidWithDecision[] = pageBids.map((b) => {
    const mapped = mapBidRecord(b, docsByBid.get(b.id) || []);
    return {
      ...mapped,
      decision: decisionByBid.get(b.id) ?? null,
    };
  });

  if (!isPaginated && !query?.status && !query?.search && !query?.sort) {
    return items;
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function resolveBidDocuments(
  db: DrizzleDb,
  bidId: string,
  orgId: string,
  storageService?: IStorageService | null,
): Promise<DemoDocument[]> {
  const docs = await db
    .select()
    .from(schema.tenderDocuments)
    .where(
      and(
        eq(schema.tenderDocuments.bidId, bidId),
        eq(schema.tenderDocuments.organizationId, orgId),
      ),
    )
    .orderBy(asc(schema.tenderDocuments.uploadedAt));

  const documents: DemoDocument[] = [];
  for (const d of docs) {
    let fileName = d.fileName;
    let storagePath = d.storagePath;
    let sizeBytes = Number(d.fileSizeBytes);

    if (
      storageService &&
      (fileName === 'Uploaded_Tender_Document.pdf' || sizeBytes === 4000000 || sizeBytes === 0)
    ) {
      try {
        if (
          fileName === 'Uploaded_Tender_Document.pdf' &&
          typeof (
            storageService as unknown as {
              findFilesByPrefix?: (p: string) => Promise<string[]>;
            }
          ).findFilesByPrefix === 'function'
        ) {
          const matched = await (
            storageService as unknown as {
              findFilesByPrefix: (p: string) => Promise<string[]>;
            }
          ).findFilesByPrefix(`tenants/${orgId}/bids/${bidId}/${d.id}/`);
          if (matched && matched.length > 0) {
            storagePath = matched[0]!;
            fileName = storagePath.split('/').pop() || fileName;
          }
        }

        const head = await storageService.headObject(storagePath);
        if (head && head.exists && head.sizeBytes > 0) {
          sizeBytes = head.sizeBytes;
        }

        void db
          .update(schema.tenderDocuments)
          .set({ fileName, storagePath, fileSizeBytes: sizeBytes })
          .where(eq(schema.tenderDocuments.id, d.id));
      } catch {
        // ignore
      }
    }

    documents.push({
      id: d.id,
      fileName,
      fileSizeBytes: sizeBytes,
      mimeType: d.mimeType,
      documentType: d.documentType,
      status: d.status,
      uploadedAt:
        d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt),
    });
  }

  return documents;
}

