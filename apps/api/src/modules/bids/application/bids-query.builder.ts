import { eq, and, asc, desc, inArray } from 'drizzle-orm';
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

  let allBids = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.organizationId, orgId));

  if (query?.companyId && typeof query.companyId === 'string' && query.companyId.trim()) {
    const targetCompanyId = query.companyId.trim();
    allBids = allBids.filter((b) => b.companyId === targetCompanyId);
  }

  if (
    query?.status &&
    typeof query.status === 'string' &&
    query.status.trim() &&
    query.status !== 'ALL'
  ) {
    const targetStatus = query.status.trim().toUpperCase();
    allBids = allBids.filter((b) => b.status.toUpperCase() === targetStatus);
  }

  if (query?.search && typeof query.search === 'string' && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    allBids = allBids.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.tenderNumber.toLowerCase().includes(q) ||
        b.tenderingAuthority.toLowerCase().includes(q) ||
        (b.locationState && b.locationState.toLowerCase().includes(q)),
    );
  }

  const sortField = query?.sort || 'createdAt';
  const isAsc = query?.order === 'asc';

  allBids.sort((a, b) => {
    let comp = 0;
    if (sortField === 'title') {
      comp = a.title.localeCompare(b.title);
    } else if (sortField === 'estimatedValueRupees') {
      comp = (Number(a.estimatedValueRupees) || 0) - (Number(b.estimatedValueRupees) || 0);
    } else if (sortField === 'submissionDeadline') {
      const da = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : 0;
      const db = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : 0;
      comp = da - db;
    } else {
      const da =
        a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const db =
        b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      comp = da - db;
    }
    return isAsc ? comp : -comp;
  });

  const total = allBids.length;
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

  const pageBids = isPaginated ? allBids.slice((page - 1) * limit, page * limit) : allBids;
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

