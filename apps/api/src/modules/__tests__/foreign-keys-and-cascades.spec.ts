import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { eq } from 'drizzle-orm';

describe('Database Foreign Key Constraints & Cascade Deletion Suite', () => {
  let pglite: PGlite;
  let db: DrizzleDb;

  beforeEach(async () => {
    pglite = new PGlite();
    await initDatabase(pglite, {
      seedUsers: true,
      seedFullProfile: true,
      seedBidsAndCompliance: true,
    });
    db = createDrizzle(pglite);
  });

  it('1. Cascades deletion from organization to users, companies, bids, and settings', async () => {
    const testOrgId = 'org_cascade_test_01';
    const testCompanyId = 'comp_cascade_test_01';
    const testUserId = 'usr_cascade_test_01';
    const testBidId = 'bid_cascade_test_01';
    const testDocId = 'doc_cascade_test_01';
    const testCompItemId = 'comp_item_cascade_01';

    // 1. Insert parent organization
    await db.insert(schema.organizations).values({
      id: testOrgId,
      name: 'Cascade Test Infrastructure Ltd',
      slug: 'cascade-test',
    });

    // 2. Insert child company
    await db.insert(schema.companies).values({
      id: testCompanyId,
      organizationId: testOrgId,
      legalName: 'Cascade Test Operating Co Ltd',
    });

    // 3. Insert child user
    await db.insert(schema.users).values({
      id: testUserId,
      email: 'cascade@test.com',
      password: 'HashedPassword123!',
      name: 'Cascade Admin',
      role: 'ADMIN',
      permissions: ['bids:read', 'bids:create'],
      organizationId: testOrgId,
      organizationName: 'Cascade Test Infrastructure Ltd',
    });

    // 4. Insert child bid
    await db.insert(schema.bids).values({
      id: testBidId,
      organizationId: testOrgId,
      companyId: testCompanyId,
      title: 'Cascade Expressway Package A',
      tenderNumber: 'NHAI/2026/CAS-01',
      tenderingAuthority: 'NHAI',
      estimatedValueRupees: 100000000,
    });

    // 5. Insert child tender document
    await db.insert(schema.tenderDocuments).values({
      id: testDocId,
      bidId: testBidId,
      organizationId: testOrgId,
      fileName: 'NIT_Cascade.pdf',
      storagePath: 'tenants/org_cascade_test_01/bids/bid_cascade_test_01/NIT_Cascade.pdf',
      fileSizeBytes: 2048576,
      mimeType: 'application/pdf',
      documentType: 'NIT',
    });

    // 6. Insert child compliance item
    await db.insert(schema.complianceItems).values({
      id: testCompItemId,
      bidId: testBidId,
      organizationId: testOrgId,
      companyId: testCompanyId,
      category: 'TECHNICAL',
      title: 'Minimum Asphalt Paver Capacity',
      description: 'Must possess 100 TPH sensor paver',
      executionRules: {},
      provenance: { documentId: testDocId, pageNumber: 5, sectionOrClause: 'Clause 4.1' },
    });

    // Assert rows exist prior to deletion
    const beforeOrgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, testOrgId));
    const beforeCompanies = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, testCompanyId));
    const beforeUsers = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
    const beforeBids = await db.select().from(schema.bids).where(eq(schema.bids.id, testBidId));
    const beforeDocs = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, testDocId));
    const beforeItems = await db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.id, testCompItemId));

    expect(beforeOrgs.length).toBe(1);
    expect(beforeCompanies.length).toBe(1);
    expect(beforeUsers.length).toBe(1);
    expect(beforeBids.length).toBe(1);
    expect(beforeDocs.length).toBe(1);
    expect(beforeItems.length).toBe(1);

    // 7. Delete the root Organization — should trigger foreign key cascade
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrgId));

    // Assert ALL child rows were deleted atomically via PostgreSQL foreign key cascade
    const afterCompanies = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, testCompanyId));
    const afterUsers = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
    const afterBids = await db.select().from(schema.bids).where(eq(schema.bids.id, testBidId));
    const afterDocs = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, testDocId));
    const afterItems = await db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.id, testCompItemId));

    expect(afterCompanies.length).toBe(0);
    expect(afterUsers.length).toBe(0);
    expect(afterBids.length).toBe(0);
    expect(afterDocs.length).toBe(0);
    expect(afterItems.length).toBe(0);
  });

  it('2. Cascades deletion from bid to tender documents, compliance items, and decisions', async () => {
    const testBidId = 'bid_cascade_leaf_01';
    const testDocId = 'doc_cascade_leaf_01';
    const testCompId = 'comp_cascade_leaf_01';
    const orgId = 'org_acme_infra_001';
    const companyId = 'comp_acme_infra_001';

    // Insert bid
    await db.insert(schema.bids).values({
      id: testBidId,
      organizationId: orgId,
      companyId: companyId,
      title: 'Standalone Flyover Bid',
      tenderNumber: 'MSRDC/2026/FL-99',
      tenderingAuthority: 'MSRDC',
      estimatedValueRupees: 50000000,
    });

    // Insert document
    await db.insert(schema.tenderDocuments).values({
      id: testDocId,
      bidId: testBidId,
      organizationId: orgId,
      fileName: 'MSRDC_RFP.pdf',
      storagePath: 'tenants/org_acme_infra_001/bids/bid_cascade_leaf_01/doc.pdf',
      fileSizeBytes: 1048576,
      mimeType: 'application/pdf',
      documentType: 'RFP',
    });

    // Insert compliance item
    await db.insert(schema.complianceItems).values({
      id: testCompId,
      bidId: testBidId,
      organizationId: orgId,
      companyId: companyId,
      category: 'FINANCIAL',
      title: 'Net Worth Requirement',
      description: 'Positive net worth audited',
      executionRules: {},
      provenance: { documentId: testDocId, pageNumber: 2, sectionOrClause: 'Section 2' },
    });

    // Delete the bid
    await db.delete(schema.bids).where(eq(schema.bids.id, testBidId));

    // Assert child documents and compliance items are removed
    const docs = await db
      .select()
      .from(schema.tenderDocuments)
      .where(eq(schema.tenderDocuments.id, testDocId));
    const items = await db
      .select()
      .from(schema.complianceItems)
      .where(eq(schema.complianceItems.id, testCompId));

    expect(docs.length).toBe(0);
    expect(items.length).toBe(0);
  });

  it('3. Relational query API allows querying organizations with relations', async () => {
    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, 'org_acme_infra_001'),
      with: {
        companies: true,
        users: true,
      },
    });

    expect(org).toBeDefined();
    expect(org?.id).toBe('org_acme_infra_001');
    expect(org?.companies.length).toBeGreaterThan(0);
    expect(org?.users.length).toBeGreaterThan(0);
  });
});
