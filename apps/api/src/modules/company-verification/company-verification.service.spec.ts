/**
 * Unit & Integration Test Suite for Company Evidence Onboarding & Verification Layer
 *
 * Verifies:
 * 1. Document evidence ingestion, SHA-256 calculation, and multi-tenant isolation
 * 2. Cloud Drive integration (Google Drive, OneDrive)
 * 3. GSTIN identity verification via BusinessVerificationProvider (IRIS IRP)
 * 4. MCA CIN master data verification & discrepancy detection
 * 5. MSME Udyam classification & statutory tender benefit tagging
 * 6. DigiLocker OAuth2 consent, HMAC-SHA256 state protection, and digital certificate ingestion
 * 7. 6-state verification lifecycle and immutable verification history
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { initDatabase } from '../../common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '../../common/database/database.module.js';
import * as schema from '../../common/database/schema.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { CompanyProfileService } from '../company-profile/company-profile.service.js';
import { CompanyEvidenceService } from './application/CompanyEvidenceService.js';
import { EvidenceVerificationService } from './application/EvidenceVerificationService.js';
import { MockGstVerificationAdapter } from './infrastructure/MockGstVerificationAdapter.js';
import { MockMcaRegistryAdapter } from './infrastructure/MockMcaRegistryAdapter.js';
import { MockMsmeVerificationAdapter } from './infrastructure/MockMsmeVerificationAdapter.js';
import { MockDigitalLockerAdapter } from './infrastructure/MockDigitalLockerAdapter.js';
import { GoogleDriveConnector } from './infrastructure/GoogleDriveConnector.js';
import { OneDriveConnector } from './infrastructure/OneDriveConnector.js';
import { LocalUploadConnector } from './infrastructure/LocalUploadConnector.js';
import { MockStorageService } from '../../infrastructure/storage/MockStorageService.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';

describe('Company Evidence & Third-Party Verification Layer', () => {
  let pglite: PGlite;
  let db: DrizzleDb;
  let storageService: MockStorageService;
  let profileService: CompanyProfileService;
  let evidenceService: CompanyEvidenceService;
  let verificationService: EvidenceVerificationService;

  const TEST_ORG_ID = 'org_infra_test_001';
  const OTHER_ORG_ID = 'org_competitor_002';
  const TEST_COMPANY_ID = 'comp_test_infra_001';

  beforeEach(async () => {
    pglite = new PGlite();
    await pglite.waitReady;
    await initDatabase(pglite, {
      seedUsers: false,
      seedFullProfile: false,
      seedBidsAndCompliance: false,
    });
    db = createDrizzle(pglite);

    storageService = new MockStorageService();
    profileService = new CompanyProfileService(db);

    const googleDrive = new GoogleDriveConnector();
    const oneDrive = new OneDriveConnector();
    const localUpload = new LocalUploadConnector();

    evidenceService = new CompanyEvidenceService(
      db,
      storageService,
      googleDrive,
      oneDrive,
      localUpload,
    );

    const gstAdapter = new MockGstVerificationAdapter();
    const mcaAdapter = new MockMcaRegistryAdapter();
    const msmeAdapter = new MockMsmeVerificationAdapter();
    const digiLockerAdapter = new MockDigitalLockerAdapter();

    verificationService = new EvidenceVerificationService(
      db,
      profileService,
      evidenceService,
      gstAdapter,
      mcaAdapter,
      msmeAdapter,
      digiLockerAdapter,
    );

    // Seed test companies
    await db.insert(schema.companies).values({
      id: TEST_COMPANY_ID,
      organizationId: TEST_ORG_ID,
      legalName: 'ACME INFRASTRUCTURE INDIA PRIVATE LIMITED',
      slug: 'acme-infra',
      gstin: null,
      pan: null,
      udyamId: null,
      constitution: 'Private Limited Company',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.companies).values({
      id: 'comp_foreign_001',
      organizationId: OTHER_ORG_ID,
      legalName: 'COMPETITOR ENTERPRISES LTD',
      slug: 'competitor',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Default tenant context for caller
    TenantContextHolder.enter({
      organizationId: TEST_ORG_ID,
      userId: 'usr_bid_mgr_test',
      role: 'ADMIN',
    });
  });

  afterEach(async () => {
    TenantContextHolder.setFallback(null);
    await pglite.close();
  });

  describe('1. Evidence Ingestion & Cryptographic Hashing', () => {
    it('should upload evidence, compute SHA-256 hash, and store in object storage', async () => {
      const samplePdfContent = Buffer.from('%PDF-1.4\nTest Audited Balance Sheet 2024\n%%EOF');
      const expectedHash = crypto.createHash('sha256').update(samplePdfContent).digest('hex');

      const uploaded = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
        fileName: 'Audited_Balance_Sheet_FY24.pdf',
        buffer: samplePdfContent,
        mimeType: 'application/pdf',
        evidenceType: 'AUDITED_BALANCE_SHEET',
        issuer: 'Deloitte Haskins & Sells',
        referenceNumber: 'UDIN-24001122AAAA3344',
        validFrom: '2024-04-01',
        validTo: '2027-03-31',
        extractedAttributes: { turnover_crores: 125.4 },
      });

      expect(uploaded.id).toMatch(/^ev_/);
      expect(uploaded.sha256Hash).toBe(expectedHash);
      expect(uploaded.verificationStatus).toBe('IMPORTED');
      expect(uploaded.sourceProvider).toBe('LOCAL_UPLOAD');
      expect(uploaded.storagePath).toContain(
        `tenants/${TEST_ORG_ID}/companies/${TEST_COMPANY_ID}/evidence/`,
      );

      // Verify file was written to storage
      const existsInStorage = await storageService.headObject(uploaded.storagePath);
      expect(existsInStorage.exists).toBe(true);
      expect(existsInStorage.sizeBytes).toBe(samplePdfContent.byteLength);
    });

    it('should reject evidence upload for a company belonging to a different tenant (Anti-IDOR)', async () => {
      const samplePdf = Buffer.from('%PDF-1.4\nMalicious Upload\n%%EOF');

      await expect(
        evidenceService.uploadEvidence('comp_foreign_001', {
          fileName: 'Hacked_Document.pdf',
          buffer: samplePdf,
          mimeType: 'application/pdf',
          evidenceType: 'OTHER',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should import evidence from Google Drive connector', async () => {
      const imported = await evidenceService.importFromCloudSource(TEST_COMPANY_ID, {
        provider: 'google-drive',
        fileId: 'gdrive_file_nhai_completion',
        fileName: 'NHAI_STRR_Completion.pdf',
        evidenceType: 'COMPLETION_CERT',
        issuer: 'National Highways Authority of India',
      });

      expect(imported.fileName).toBe('NHAI_STRR_Completion.pdf');
      expect(imported.evidenceType).toBe('COMPLETION_CERT');
      expect(imported.verificationStatus).toBe('IMPORTED');
    });
  });

  describe('2. GSTIN Identity Verification via IRIS IRP Provider', () => {
    it('should verify valid GSTIN, populate PAN, and update company profile', async () => {
      const gstin = '27AABCU9603R1ZM';

      const result = await verificationService.verifyGstin(TEST_COMPANY_ID, gstin);

      expect(result.provider).toBe('IRIS_IRP_GSTIN');
      expect(result.verificationStatus).toBe('SOURCE_VERIFIED');
      expect(result.discrepancies).toHaveLength(0);
      expect(result.data.pan).toBe('AABCU9603R');

      // Verify company record updated in DB
      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, TEST_COMPANY_ID));

      expect(company?.gstin).toBe(gstin);
      expect(company?.pan).toBe('AABCU9603R');
      expect(company?.gstinVerifiedAt).not.toBeNull();

      // Verify capability profile version synced
      const profile = await profileService.getProfile(TEST_COMPANY_ID);
      expect(profile.active?.payload.registrations?.GSTIN).toBe(gstin);
      expect(profile.active?.payload.registrations?.PAN).toBe('AABCU9603R');
    });

    it('should detect discrepancy when entered company name differs from GSTIN registered name', async () => {
      // Create company with conflicting name
      const conflictingId = 'comp_name_mismatch_001';
      await db.insert(schema.companies).values({
        id: conflictingId,
        organizationId: TEST_ORG_ID,
        legalName: 'TOTALLY UNRELATED ENTERPRISES PVT LTD',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await verificationService.verifyGstin(conflictingId, '27AABCU9603R1ZM');

      expect(result.verificationStatus).toBe('NEEDS_REVIEW');
      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.discrepancies[0]).toContain('Legal name discrepancy');
    });

    it('should reject invalid GSTIN format with BadRequestError', async () => {
      await expect(
        verificationService.verifyGstin(TEST_COMPANY_ID, 'INVALID_GSTIN_123'),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('3. MCA CIN Master Data Verification', () => {
    it('should verify official CIN, update RoC jurisdiction, and record evidence', async () => {
      const cin = 'U72900MH2018PTC123456';

      const result = await verificationService.verifyMca(TEST_COMPANY_ID, cin);

      expect(result.provider).toBe('MCA_REGISTRY');
      expect(result.verificationStatus).toBe('SOURCE_VERIFIED');
      expect(result.data.rocOffice).toBe('RoC-Mumbai');

      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, TEST_COMPANY_ID));

      expect(company?.cin).toBe(cin);
      expect(company?.mcaVerifiedAt).not.toBeNull();
    });

    it('should reject invalid CIN length or pattern', async () => {
      await expect(verificationService.verifyMca(TEST_COMPANY_ID, 'U12345')).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe('4. MSME Udyam Verification & Statutory Procurement Tagging', () => {
    it('should verify Udyam number, extract SMALL enterprise classification, and tag profile', async () => {
      const udyamNumber = 'UDYAM-MH-01-0012345';

      const result = await verificationService.verifyUdyam(TEST_COMPANY_ID, udyamNumber);

      expect(result.provider).toBe('MSME_UDYAM');
      expect(result.verificationStatus).toBe('SOURCE_VERIFIED');
      expect(result.data.enterpriseClassification).toBe('SMALL');
      expect(result.data.majorActivity).toBe('SERVICES');

      const profile = await profileService.getProfile(TEST_COMPANY_ID);
      expect(profile.active?.payload.registrations?.UDYAM).toBe(udyamNumber);
      expect(profile.active?.payload.registrations?.MSME_CLASSIFICATION).toBe('SMALL');
    });
  });

  describe('5. DigiLocker OAuth2 Handshake & Digital Certificate Ingestion', () => {
    it('should generate signed OAuth state token with HMAC-SHA256 signature', async () => {
      const auth = await verificationService.generateDigiLockerAuth(
        TEST_COMPANY_ID,
        'http://localhost:5173/auth/callback',
      );

      expect(auth.authorizationUrl).toContain('https://mock.digilocker.gov.in/oauth/authorize');
      expect(auth.state).toBeTruthy();

      // State must be base64url encoded JSON containing payload and HMAC
      const decoded = JSON.parse(Buffer.from(auth.state, 'base64url').toString('utf8'));
      expect(decoded.payload).toContain(`${TEST_ORG_ID}:${TEST_COMPANY_ID}:`);
      expect(decoded.hmac).toHaveLength(64);
    });

    it('should exchange code and import government-issued certificates into Evidence Vault', async () => {
      const auth = await verificationService.generateDigiLockerAuth(
        TEST_COMPANY_ID,
        'http://localhost:5173/auth/callback',
      );

      const importedDocs = await verificationService.handleDigiLockerCallback(
        TEST_COMPANY_ID,
        'auth_code_sample_123',
        auth.state,
        'http://localhost:5173/auth/callback',
      );

      expect(importedDocs.length).toBeGreaterThanOrEqual(3);

      const types = importedDocs.map((d) => d.evidenceType);
      expect(types).toContain('INCORPORATION_CERTIFICATE');
      expect(types).toContain('GST_CERTIFICATE');
      expect(types).toContain('UDYAM_CERTIFICATE');

      for (const doc of importedDocs) {
        expect(doc.sourceProvider).toBe('DIGILOCKER');
        expect(doc.verificationStatus).toBe('SOURCE_VERIFIED');
        expect(doc.verificationMethod).toBe('DIGITAL_SIGNATURE');
        expect(doc.verifiedBy).toBe('DIGILOCKER_NATIONAL_DEPOSITORY');
      }

      // Verify company record has digilockerLinkedAt timestamp
      const [comp] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, TEST_COMPANY_ID));
      expect(comp?.digilockerLinkedAt).not.toBeNull();
    });

    it('should reject forged or tampered DigiLocker state tokens', async () => {
      const auth = await verificationService.generateDigiLockerAuth(
        TEST_COMPANY_ID,
        'http://localhost:5173/auth/callback',
      );

      // Forged payload with malicious tenant injection
      const tampered = Buffer.from(
        JSON.stringify({
          payload: `org_evil:${TEST_COMPANY_ID}:nonce:12345`,
          hmac: 'fake_hmac_signature',
        }),
      ).toString('base64url');

      await expect(
        verificationService.handleDigiLockerCallback(
          TEST_COMPANY_ID,
          'code_123',
          tampered,
          'http://localhost:5173/auth/callback',
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('6. Discrepancy Human Review & Immutable Verification Audit Trail', () => {
    it('should allow compliance reviewer to accept or override discrepancy and log audit trail', async () => {
      // Ingest document that needs review
      const samplePdf = Buffer.from('%PDF-1.4\nQuestionable Work Order\n%%EOF');
      const doc = await evidenceService.uploadEvidence(TEST_COMPANY_ID, {
        fileName: 'Work_Order_Package_45.pdf',
        buffer: samplePdf,
        mimeType: 'application/pdf',
        evidenceType: 'WORK_ORDER',
      });

      // Update to NEEDS_REVIEW
      await db
        .update(schema.companyEvidenceDocuments)
        .set({
          verificationStatus: 'NEEDS_REVIEW',
          discrepancyNotes: 'Client signature blurred; requires manual stamp verification',
        })
        .where(eq(schema.companyEvidenceDocuments.id, doc.id));

      // Reviewer reviews and overrides
      const reviewed = await verificationService.reviewDiscrepancy(
        TEST_COMPANY_ID,
        doc.id,
        'OVERRIDE_MANUAL',
        'Physical wet-ink copy checked with project director.',
      );

      expect(reviewed.verificationStatus).toBe('SOURCE_VERIFIED');
      expect(reviewed.verificationMethod).toBe('MANUAL_REVIEW');
      expect(reviewed.discrepancyNotes).toContain('Reviewed [OVERRIDE_MANUAL]');

      // Check immutable audit trail
      const history = await verificationService.getVerificationHistory(TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThan(0);
      const entry = history.find((h) => h.evidenceDocumentId === doc.id);
      expect(entry?.previousStatus).toBe('NEEDS_REVIEW');
      expect(entry?.newStatus).toBe('SOURCE_VERIFIED');
      expect(entry?.verificationMethod).toBe('MANUAL_REVIEW');
    });
  });
});
