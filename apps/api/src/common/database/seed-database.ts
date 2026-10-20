import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import {
  DEMO_USERS,
  DEMO_COMPANIES,
  BIDS,
  DEMO_COMPANY_PROFILE_PAYLOAD,
  DEMO_COMPLIANCE_ITEMS,
  DEMO_BID_DECISION_SEED,
} from '@/seed/data.js';

export interface SeedDatabaseOptions {
  seedUsers?: boolean;
  seedFullProfile?: boolean;
  seedBidsAndCompliance?: boolean;
}

/**
 * Seeds baseline demo data for users, companies, bids, compliance items,
 * company evidence, decisions, notifications, and subscriptions.
 */
export async function seedDatabase(
  drizzleDb: DrizzleDb,
  options?: SeedDatabaseOptions,
): Promise<void> {
  const seedUsers = options?.seedUsers ?? false;
  const seedFullProfile = options?.seedFullProfile ?? false;
  const seedBidsAndCompliance = options?.seedBidsAndCompliance ?? false;

  // 1. Seed Organizations, Users & Companies
  if (seedUsers) {
    for (const user of DEMO_USERS) {
      await drizzleDb
        .insert(schema.organizations)
        .values({
          id: user.organizationId,
          name: user.organizationName,
          slug: user.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, ''),
          domain: user.email.split('@')[1] ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    for (const comp of DEMO_COMPANIES) {
      await drizzleDb
        .insert(schema.organizations)
        .values({
          id: comp.organizationId,
          name: comp.legalName,
          slug: (comp.slug || comp.legalName)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, ''),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    for (const user of DEMO_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await drizzleDb
        .insert(schema.users)
        .values({
          id: user.id,
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
        })
        .onConflictDoNothing();
    }

    // Migration: ensure any existing users with plaintext passwords are upgraded to bcrypt hashes
    const unhashedUsers = await drizzleDb
      .select({ id: schema.users.id, password: schema.users.password })
      .from(schema.users)
      .where(
        sql`${schema.users.password} NOT LIKE '$2b$%' AND ${schema.users.password} NOT LIKE '$2a$%'`,
      );

    for (const u of unhashedUsers) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await drizzleDb
        .update(schema.users)
        .set({ password: hashedPassword })
        .where(eq(schema.users.id, u.id));
    }

    // Seed Companies
    for (const comp of DEMO_COMPANIES) {
      await drizzleDb
        .insert(schema.companies)
        .values({
          id: comp.id,
          organizationId: comp.organizationId,
          legalName: comp.legalName,
          slug: comp.slug ?? null,
          gstin: comp.gstin ?? null,
          pan: comp.pan ?? null,
          udyamId: comp.udyamId ?? null,
          constitution: comp.constitution ?? null,
          createdAt: new Date(comp.createdAt),
          updatedAt: new Date(comp.updatedAt),
        })
        .onConflictDoNothing();
    }
  }

  // 2. Seed Company Capability Profile (11 domains)
  if (seedFullProfile) {
    await drizzleDb
      .insert(schema.companyProfileVersions)
      .values({
        id: 'cpv-acme-v1',
        companyId: 'comp_acme_infra_001',
        organizationId: 'org_acme_infra_001',
        version: 1,
        name: 'V1.0 (Active Baseline)',
        payload: DEMO_COMPANY_PROFILE_PAYLOAD,
        createdBy: 'usr_bid_mgr_01',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      })
      .onConflictDoNothing();

    await drizzleDb
      .insert(schema.companyProfiles)
      .values({
        id: 'prof_comp_acme_infra_001',
        companyId: 'comp_acme_infra_001',
        organizationId: 'org_acme_infra_001',
        activeVersionId: 'cpv-acme-v1',
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      })
      .onConflictDoNothing();

    // 2b. Seed Company Evidence Documents & Chunks for Acme Infrastructure
    await drizzleDb
      .insert(schema.companyEvidenceDocuments)
      .values([
        {
          id: 'doc-ev-ca-audited-fy25',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'Audited_Balance_Sheet_and_CA_Certificate_FY25.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-ca-audited-fy25.pdf',
          fileSizeBytes: 2450000,
          mimeType: 'application/pdf',
          sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          evidenceType: 'AUDITED_BALANCE_SHEET',
          issuer: 'K. S. Rao & Associates, Chartered Accountants',
          referenceNumber: 'UDIN-25089745AAAAAA1234',
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
        {
          id: 'doc-ev-completion-nhai-strr',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'NHAI_STRR_Package_3_Completion_Certificate.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-completion-nhai-strr.pdf',
          fileSizeBytes: 3120000,
          mimeType: 'application/pdf',
          sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
          evidenceType: 'COMPLETION_CERT',
          issuer: 'National Highways Authority of India',
          referenceNumber: 'NHAI/STRR/PKG-3/COMP/2023/89',
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
        {
          id: 'doc-ev-cert-iso-9001',
          companyId: 'comp_acme_infra_001',
          organizationId: 'org_acme_infra_001',
          fileName: 'ISO_9001_2015_Quality_Management_Certificate.pdf',
          storagePath: 'tenants/org_acme_infra_001/evidence/doc-ev-cert-iso-9001.pdf',
          fileSizeBytes: 1850000,
          mimeType: 'application/pdf',
          sha256Hash: 'f4e3d2c1b0a987654321fedcba0987654321fedcba0987654321fedcba098765',
          evidenceType: 'ISO_CERT',
          issuer: 'Bureau Veritas Certification India',
          referenceNumber: 'BVC-IND-2023-0941',
          validFrom: new Date('2023-01-15T00:00:00.000Z'),
          validTo: new Date('2026-12-31T00:00:00.000Z'),
          verificationStatus: 'SOURCE_VERIFIED',
          importedAt: new Date('2026-08-15T00:00:00.000Z'),
          createdAt: new Date('2026-08-15T00:00:00.000Z'),
          updatedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
      ])
      .onConflictDoNothing();

    await drizzleDb
      .insert(schema.companyEvidenceChunks)
      .values([
        {
          id: 'chk-ev-ca-fy25-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-ca-audited-fy25',
          chunkIndex: 1,
          chunkType: 'CERTIFICATE_KEY_VALUE',
          content: 'Statutory Annual Financial Turnover: M/s Acme Infrastructure Solutions Ltd has achieved an Annual Financial Turnover of INR 320.50 Crores for the Financial Year 2024-25. 3-Year Average Annual Financial Turnover is INR 281.90 Crores. Certified by Statutory Auditor K. S. Rao & Associates, Chartered Accountants under UDIN 25089745AAAAAA1234.',
          pageNumber: 2,
          clauseReference: 'Financial Statement Clause 2.1',
          metadata: {
            financial_year: '2024-2025',
            turnover_inr_crores: 320.5,
            avg_turnover_inr_crores: 281.9,
            ca_udin: '25089745AAAAAA1234',
            is_audited: true,
            file_name: 'Audited_Balance_Sheet_and_CA_Certificate_FY25.pdf',
          },
        },
        {
          id: 'chk-ev-completion-nhai-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-completion-nhai-strr',
          chunkIndex: 1,
          chunkType: 'PROSE',
          content: 'Work Completion Certificate: This is to certify that Acme Infrastructure Solutions Ltd has successfully completed the Satellite Town Ring Road (STRR) Package-3 Construction project for National Highways Authority of India (NHAI) with final contract value of INR 215.00 Crores. Work completed on 20-Nov-2023.',
          pageNumber: 1,
          clauseReference: 'Completion Schedule Para 3',
          metadata: {
            client_name: 'NHAI',
            contract_value_inr_crores: 215.0,
            completion_date: '2023-11-20',
            file_name: 'NHAI_STRR_Package_3_Completion_Certificate.pdf',
          },
        },
        {
          id: 'chk-ev-iso-9001-01',
          organizationId: 'org_acme_infra_001',
          companyId: 'comp_acme_infra_001',
          evidenceDocumentId: 'doc-ev-cert-iso-9001',
          chunkIndex: 1,
          chunkType: 'CERTIFICATE_KEY_VALUE',
          content: 'Quality Management System Certificate ISO 9001:2015: Certified that Acme Infrastructure Solutions Ltd operates a Quality Management System complying with ISO 9001:2015 for Civil Infrastructure, Highways, and Bridges. Certificate BVC-IND-2023-0941, valid until 31-Dec-2026.',
          pageNumber: 1,
          clauseReference: 'Certificate Schedule',
          metadata: {
            standard_name: 'ISO 9001:2015',
            issuing_body: 'Bureau Veritas Certification India',
            valid_to: '2026-12-31',
            file_name: 'ISO_9001_2015_Quality_Management_Certificate.pdf',
          },
        },
      ])
      .onConflictDoNothing();
  }

  // 3. Seed Bids & Tender Documents if enabled (only on fresh database)
  if (seedBidsAndCompliance) {
    const existingBidsCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.bids);
    const existingBidsCount = parseInt(existingBidsCountResult[0]?.count || '0', 10);

    if (existingBidsCount === 0) {
      for (const bid of BIDS) {
        await drizzleDb
          .insert(schema.bids)
          .values({
            id: bid.id,
            organizationId: 'org_acme_infra_001',
            companyId: bid.companyId || 'comp_acme_infra_001',
            title: bid.title,
            tenderNumber: bid.tenderNumber,
            tenderingAuthority: bid.tenderingAuthority,
            estimatedValueRupees: bid.estimatedValueRupees,
            submissionDeadline: bid.submissionDeadline,
            locationState: bid.locationState || null,
            status: bid.status,
            totalRequirements: bid.totalRequirements,
            flaggedRequirements: bid.flaggedRequirements,
            approvedRequirements: bid.approvedRequirements,
            version: 1,
            createdAt: new Date(bid.createdAt),
            updatedAt: new Date(bid.updatedAt),
          })
          .onConflictDoNothing();

        // Seed documents for this bid
        if (bid.documents && bid.documents.length > 0) {
          for (const doc of bid.documents) {
            await drizzleDb
              .insert(schema.tenderDocuments)
              .values({
                id: doc.id,
                bidId: bid.id,
                organizationId: 'org_acme_infra_001',
                fileName: doc.fileName,
                storagePath: `bids/${bid.id}/${doc.id}-${doc.fileName}`,
                fileSizeBytes: doc.fileSizeBytes,
                mimeType: doc.mimeType,
                documentType: doc.documentType,
                status: doc.status,
                uploadedAt: new Date(doc.uploadedAt),
              })
              .onConflictDoNothing();
          }
        }

        await drizzleDb
          .insert(schema.auditLogs)
          .values({
            id: `aud-init-${bid.id}`,
            bidId: bid.id,
            organizationId: 'org_acme_infra_001',
            userId: 'usr_bid_mgr_01',
            userName: 'Vikramaditya Sharma',
            eventType: 'BID_PROJECT_CREATED',
            aggregateType: 'BidProject',
            aggregateId: bid.id,
            payload: { title: bid.title, tenderNumber: bid.tenderNumber },
            timestamp: new Date(bid.createdAt),
          })
          .onConflictDoNothing();
      }

      // 4. Seed Compliance Items if enabled
      for (const item of DEMO_COMPLIANCE_ITEMS) {
        await drizzleDb
          .insert(schema.complianceItems)
          .values({
            id: item.id,
            bidId: item.bidId,
            organizationId: 'org_acme_infra_001',
            category: item.category,
            title: item.title,
            description: item.description,
            status: item.status,
            humanReviewRequired: item.humanReviewRequired,
            reviewNotes: item.reviewNotes,
            reviewedBy: item.reviewedBy,
            reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
            version: item.version,
            executionRules: item.executionRules,
            provenance: item.provenance,
            companyEvidence: item.companyEvidence ?? null,
            risk: item.risk ?? null,
            rationale: item.rationale ?? null,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })
          .onConflictDoNothing();
      }
    }

    // 5. Seed Persisted Bid Decision if empty
    const decisionCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.bidDecisions);
    const decisionCount = parseInt(decisionCountResult[0]?.count || '0', 10);

    if (decisionCount === 0) {
      console.log('🌱 Seeding persisted deterministic bid decision into PostgreSQL...');
      await drizzleDb
        .insert(schema.bidDecisions)
        .values({
          id: DEMO_BID_DECISION_SEED.id,
          bidId: DEMO_BID_DECISION_SEED.bidId,
          organizationId: DEMO_BID_DECISION_SEED.organizationId,
          profileVersionId: DEMO_BID_DECISION_SEED.profileVersionId,
          verdict: DEMO_BID_DECISION_SEED.verdict,
          state: DEMO_BID_DECISION_SEED.state,
          readinessScore: DEMO_BID_DECISION_SEED.readinessScore,
          response: DEMO_BID_DECISION_SEED.response,
          createdAt: new Date(DEMO_BID_DECISION_SEED.createdAt),
        })
        .onConflictDoNothing();
    }

    // 6. Seed Notifications if empty
    const notificationCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.notifications);
    const notificationCount = parseInt(notificationCountResult[0]?.count || '0', 10);

    if (notificationCount === 0) {
      console.log('🌱 Seeding realistic procurement notifications into PostgreSQL...');
      const demoNotifications = [
        {
          id: 'notif-001',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'REVIEW_REQUEST',
          channel: 'IN_APP',
          priority: 'HIGH',
          title: 'Human Review Required: Non-Blacklisting Affidavit',
          message:
            'Clause 1.4.3 requires notarized affidavit on ₹500 Maharashtra e-Stamp paper for NHAI EPC bypass tender.',
          metadata: { bidId: 'bid-nhai-44-001', complianceItemId: 'comp-nhai-003' },
          isRead: false,
          createdAt: new Date('2026-10-02T10:15:00.000Z'),
        },
        {
          id: 'notif-002',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'DEADLINE',
          channel: 'IN_APP',
          priority: 'MEDIUM',
          title: 'Tender Submission Deadline Reminder',
          message:
            'Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200) submission deadline is in 40 days (15-Nov-2026).',
          metadata: { bidId: 'bid-nhai-44-001', deadline: '2026-11-15T15:00:00.000Z' },
          isRead: false,
          createdAt: new Date('2026-10-03T09:00:00.000Z'),
        },
        {
          id: 'notif-003',
          organizationId: 'org_acme_infra_001',
          recipientUserId: 'usr_bid_mgr_01',
          category: 'EVIDENCE_EXPIRY',
          channel: 'IN_APP',
          priority: 'LOW',
          title: 'CA Turnover Certificate Verified',
          message:
            '3-Year CA Turnover Certificate (UDIN 25089745AAAAAA1234) successfully matched against NHAI financial eligibility.',
          metadata: { companyId: 'comp_acme_infra_001', udin: '25089745AAAAAA1234' },
          isRead: true,
          createdAt: new Date('2026-10-01T11:00:00.000Z'),
        },
      ];

      for (const n of demoNotifications) {
        await drizzleDb.insert(schema.notifications).values(n).onConflictDoNothing();
      }
    }

    // 7. Seed Subscriptions if empty
    const subCountResult = await drizzleDb
      .select({ count: sql<string>`count(*)` })
      .from(schema.subscriptions);
    const subCount = parseInt(subCountResult[0]?.count || '0', 10);

    if (subCount === 0) {
      console.log('🌱 Seeding tenant subscriptions into PostgreSQL...');
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await drizzleDb
        .insert(schema.subscriptions)
        .values([
          {
            id: 'sub_acme_growth_001',
            organizationId: 'org_acme_infra_001',
            planTier: 'GROWTH',
            billingInterval: 'MONTHLY',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
          {
            id: 'sub_bharat_starter_002',
            organizationId: 'org_bharat_build_002',
            planTier: 'STARTER',
            billingInterval: 'MONTHLY',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        ])
        .onConflictDoNothing();
    }
  }
}
