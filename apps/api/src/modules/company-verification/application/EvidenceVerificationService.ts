/**
 * EvidenceVerificationService — Coordinates multi-provider identity & evidence verification.
 *
 * Implements:
 * 1. GSTIN verification via BusinessVerificationProvider (IRIS IRP / Mock)
 * 2. MCA CIN/LLPIN master data verification via CompanyRegistryProvider
 * 3. MSME Udyam classification verification via IMsmeVerificationPort
 * 4. DigiLocker OAuth2 consent & digitally issued document ingestion
 * 5. Discrepancy detection between registry data and company profiles
 * 6. Multi-state verification lifecycle (IMPORTED -> EXTRACTED -> SOURCE_VERIFIED -> NEEDS_REVIEW -> EXPIRED -> REJECTED)
 * 7. Immutable verification history logging
 */
import { Injectable, Inject, Optional } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import crypto from 'node:crypto';
import { type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { CompanyEvidenceService } from '@/modules/company-verification/application/CompanyEvidenceService.js';
import {
  BUSINESS_VERIFICATION_PROVIDER,
  type BusinessVerificationProvider,
} from '@/modules/company-verification/domain/ports/BusinessVerificationProvider.js';
import {
  COMPANY_REGISTRY_PROVIDER,
  type CompanyRegistryProvider,
} from '@/modules/company-verification/domain/ports/CompanyRegistryProvider.js';
import {
  MSME_VERIFICATION_PORT,
  type IMsmeVerificationPort,
} from '@/modules/company-verification/domain/ports/IMsmeVerificationPort.js';
import {
  DIGITAL_DOCUMENT_PROVIDER,
  type DigitalDocumentProvider,
} from '@/modules/company-verification/domain/ports/DigitalDocumentProvider.js';
import { CompanyVerificationRepository } from '@/modules/company-verification/company-verification.repository.js';

export interface VerificationResultView {
  companyId: string;
  provider: 'IRIS_IRP_GSTIN' | 'MCA_REGISTRY' | 'MSME_UDYAM' | 'DIGILOCKER';
  verificationStatus: schema.EvidenceVerificationStatus;
  discrepancies: string[];
  data: Record<string, unknown>;
  verifiedAt: string;
}

@Injectable()
export class EvidenceVerificationService {
  private readonly repository: CompanyVerificationRepository;

  constructor(
    @Inject(CompanyVerificationRepository)
    repoOrDb: CompanyVerificationRepository | DrizzleDb | PGlite,
    @Inject(CompanyProfileService)
    private readonly companyProfileService: CompanyProfileService,
    @Inject(CompanyEvidenceService)
    private readonly companyEvidenceService: CompanyEvidenceService,
    @Inject(BUSINESS_VERIFICATION_PROVIDER)
    private readonly businessVerificationProvider: BusinessVerificationProvider,
    @Inject(COMPANY_REGISTRY_PROVIDER)
    private readonly companyRegistryProvider: CompanyRegistryProvider,
    @Inject(MSME_VERIFICATION_PORT)
    private readonly msmeVerificationPort: IMsmeVerificationPort,
    @Inject(DIGITAL_DOCUMENT_PROVIDER)
    private readonly digitalDocumentProvider: DigitalDocumentProvider,
    @Optional()
    @Inject(CompanyVerificationRepository)
    repository?: CompanyVerificationRepository,
  ) {
    if (repoOrDb instanceof CompanyVerificationRepository) {
      this.repository = repoOrDb;
    } else if (repository) {
      this.repository = repository;
    } else {
      this.repository = new CompanyVerificationRepository(repoOrDb);
    }
  }

  /**
   * Verify GSTIN via IRIS IRP, detect discrepancies, and update company profile.
   */
  public async verifyGstin(companyId: string, gstin: string): Promise<VerificationResultView> {
    const orgId = this.requireOrg();
    const company = await this.getCompany(companyId, orgId);

    // 1. Fetch official taxpayer details via port adapter
    const taxpayer = await this.businessVerificationProvider.verifyGstin(gstin);

    // 2. Discrepancy analysis
    const discrepancies: string[] = [];
    const normalizedProfileName = this.normalizeName(company.legalName);
    const normalizedGstName = this.normalizeName(taxpayer.legalName);

    if (
      normalizedProfileName &&
      normalizedGstName &&
      !normalizedProfileName.includes(normalizedGstName) &&
      !normalizedGstName.includes(normalizedProfileName)
    ) {
      discrepancies.push(
        `Legal name discrepancy: Profile shows '${company.legalName}', but GSTIN record shows '${taxpayer.legalName}'.`,
      );
    }

    if (taxpayer.status !== 'ACTIVE') {
      discrepancies.push(`GSTIN registration status is '${taxpayer.status}' (not ACTIVE).`);
    }

    const verificationStatus: schema.EvidenceVerificationStatus =
      discrepancies.length > 0
        ? schema.EvidenceVerificationStatus.NEEDS_REVIEW
        : schema.EvidenceVerificationStatus.SOURCE_VERIFIED;

    const now = new Date();

    // 3. Update companies table
    await this.repository.updateCompany(companyId, {
      gstin: taxpayer.gstin,
      pan: taxpayer.pan,
      legalName: discrepancies.length === 0 ? taxpayer.legalName : company.legalName,
      constitution: taxpayer.constitution || company.constitution,
      gstinVerifiedAt: now,
      gstinVerificationData: taxpayer as unknown as Record<string, unknown>,
      updatedAt: now,
    });

    // 4. Update or create GST registration evidence document
    await this.recordEvidenceDocument(companyId, orgId, {
      evidenceType: 'GST_REG',
      fileName: `GSTIN_${taxpayer.gstin}_Verification.pdf`,
      issuer: 'Goods and Services Tax Network (GSTN)',
      referenceNumber: taxpayer.gstin,
      validFrom: taxpayer.dateOfRegistration ? new Date(taxpayer.dateOfRegistration) : null,
      verificationStatus,
      verificationMethod: 'REGISTRY_API',
      discrepancies,
      rawPayload: taxpayer as unknown as Record<string, unknown>,
    });

    // 5. Pin updated CompanyProfileVersion
    await this.syncToProfile(
      companyId,
      {
        company_name: discrepancies.length === 0 ? taxpayer.legalName : company.legalName,
        registrations: {
          GSTIN: taxpayer.gstin,
          PAN: taxpayer.pan,
        },
        operating_regions: taxpayer.principalAddress?.state
          ? [taxpayer.principalAddress.state]
          : undefined,
      },
      `Verified via IRIS IRP GSTIN (${taxpayer.gstin})`,
    );

    return {
      companyId,
      provider: 'IRIS_IRP_GSTIN',
      verificationStatus,
      discrepancies,
      data: taxpayer as unknown as Record<string, unknown>,
      verifiedAt: now.toISOString(),
    };
  }

  /**
   * Verify MCA CIN/LLPIN master data, detect legal identity discrepancies.
   */
  public async verifyMca(companyId: string, cinOrLlpin: string): Promise<VerificationResultView> {
    const orgId = this.requireOrg();
    const company = await this.getCompany(companyId, orgId);

    const mca = await this.companyRegistryProvider.verifyCin(cinOrLlpin);

    const discrepancies: string[] = [];
    const normalizedProfileName = this.normalizeName(company.legalName);
    const normalizedMcaName = this.normalizeName(mca.companyName);

    if (
      normalizedProfileName &&
      normalizedMcaName &&
      !normalizedProfileName.includes(normalizedMcaName) &&
      !normalizedMcaName.includes(normalizedProfileName)
    ) {
      discrepancies.push(
        `Company name discrepancy: Profile shows '${company.legalName}', but MCA registry shows '${mca.companyName}'.`,
      );
    }

    if (mca.status !== 'ACTIVE') {
      discrepancies.push(`MCA company status is '${mca.status}'.`);
    }

    const verificationStatus: schema.EvidenceVerificationStatus =
      discrepancies.length > 0
        ? schema.EvidenceVerificationStatus.NEEDS_REVIEW
        : schema.EvidenceVerificationStatus.SOURCE_VERIFIED;

    const now = new Date();

    await this.repository.updateCompany(companyId, {
      cin: mca.cinOrLlpin,
      legalName: discrepancies.length === 0 ? mca.companyName : company.legalName,
      mcaVerifiedAt: now,
      mcaVerificationData: mca as unknown as Record<string, unknown>,
      updatedAt: now,
    });

    await this.recordEvidenceDocument(companyId, orgId, {
      evidenceType: 'INCORPORATION_CERT',
      fileName: `MCA_Master_Data_${mca.cinOrLlpin}.pdf`,
      issuer: 'Ministry of Corporate Affairs (MCA)',
      referenceNumber: mca.cinOrLlpin,
      validFrom: mca.dateOfIncorporation ? new Date(mca.dateOfIncorporation) : null,
      verificationStatus,
      verificationMethod: 'REGISTRY_API',
      discrepancies,
      rawPayload: mca as unknown as Record<string, unknown>,
    });

    await this.syncToProfile(
      companyId,
      {
        company_name: discrepancies.length === 0 ? mca.companyName : company.legalName,
        registrations: {
          CIN: mca.cinOrLlpin,
        },
      },
      `Verified via MCA Registry (${mca.cinOrLlpin})`,
    );

    return {
      companyId,
      provider: 'MCA_REGISTRY',
      verificationStatus,
      discrepancies,
      data: mca as unknown as Record<string, unknown>,
      verifiedAt: now.toISOString(),
    };
  }

  /**
   * Verify MSME Udyam registration, update classification & statutory tender benefits.
   */
  public async verifyUdyam(
    companyId: string,
    udyamNumber: string,
  ): Promise<VerificationResultView> {
    const orgId = this.requireOrg();
    const company = await this.getCompany(companyId, orgId);

    const msme = await this.msmeVerificationPort.verifyUdyam(udyamNumber);

    const discrepancies: string[] = [];
    const normalizedProfileName = this.normalizeName(company.legalName);
    const normalizedMsmeName = this.normalizeName(msme.enterpriseName);

    if (
      normalizedProfileName &&
      normalizedMsmeName &&
      !normalizedProfileName.includes(normalizedMsmeName) &&
      !normalizedMsmeName.includes(normalizedProfileName)
    ) {
      discrepancies.push(
        `Enterprise name discrepancy: Profile shows '${company.legalName}', but Udyam shows '${msme.enterpriseName}'.`,
      );
    }

    const verificationStatus: schema.EvidenceVerificationStatus =
      discrepancies.length > 0
        ? schema.EvidenceVerificationStatus.NEEDS_REVIEW
        : schema.EvidenceVerificationStatus.SOURCE_VERIFIED;

    const now = new Date();

    await this.repository.updateCompany(companyId, {
      udyamId: msme.udyamRegistrationNumber,
      udyamVerifiedAt: now,
      udyamVerificationData: msme as unknown as Record<string, unknown>,
      updatedAt: now,
    });

    await this.recordEvidenceDocument(companyId, orgId, {
      evidenceType: 'UDYAM_CERT',
      fileName: `Udyam_Registration_${msme.udyamRegistrationNumber}.pdf`,
      issuer: 'Ministry of Micro, Small and Medium Enterprises',
      referenceNumber: msme.udyamRegistrationNumber,
      validFrom: msme.dateOfIncorporation ? new Date(msme.dateOfIncorporation) : null,
      verificationStatus,
      verificationMethod: 'REGISTRY_API',
      discrepancies,
      rawPayload: msme as unknown as Record<string, unknown>,
    });

    await this.syncToProfile(
      companyId,
      {
        registrations: {
          UDYAM: msme.udyamRegistrationNumber,
          MSME_CLASSIFICATION: msme.enterpriseClassification,
          MSME_ACTIVITY: msme.majorActivity,
        },
      },
      `Verified via MSME Udyam (${msme.udyamRegistrationNumber})`,
    );

    return {
      companyId,
      provider: 'MSME_UDYAM',
      verificationStatus,
      discrepancies,
      data: msme as unknown as Record<string, unknown>,
      verifiedAt: now.toISOString(),
    };
  }

  /**
   * Generate DigiLocker OAuth2 consent URL.
   */
  public async generateDigiLockerAuth(companyId: string, redirectUri: string) {
    const orgId = this.requireOrg();
    await this.getCompany(companyId, orgId);
    return this.digitalDocumentProvider.generateAuthUrl(orgId, companyId, redirectUri);
  }

  /**
   * Handle DigiLocker callback: exchanges code, imports official certificates into evidence vault.
   */
  public async handleDigiLockerCallback(
    companyId: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<schema.CompanyEvidenceDocument[]> {
    const orgId = this.requireOrg();
    await this.getCompany(companyId, orgId);

    const tokenRes = await this.digitalDocumentProvider.exchangeCodeForToken(
      code,
      state,
      redirectUri,
    );
    const issuedDocs = await this.digitalDocumentProvider.fetchIssuedDocuments(
      tokenRes.accessToken,
    );

    const importedRecords: schema.CompanyEvidenceDocument[] = [];
    const now = new Date();

    for (const doc of issuedDocs) {
      const evidence = await this.companyEvidenceService.uploadEvidence(companyId, {
        fileName: doc.docName,
        buffer: doc.fileBuffer,
        mimeType: doc.mimeType,
        evidenceType: doc.docType,
        issuer: doc.issuer,
        referenceNumber: (doc.metadata?.cin ||
          doc.metadata?.gstin ||
          doc.metadata?.udyamNumber ||
          doc.uri) as string,
        validFrom: doc.issueDate,
      });

      // Update to SOURCE_VERIFIED with DigiLocker provenance
      const updated = await this.repository.updateEvidenceDocumentVerification(evidence.id, {
        sourceProvider: 'DIGILOCKER',
        sourceReference: doc.uri,
        verificationStatus: 'SOURCE_VERIFIED',
        verificationMethod: 'DIGITAL_SIGNATURE',
        verifiedAt: now,
        verifiedBy: 'DIGILOCKER_NATIONAL_DEPOSITORY',
        updatedAt: now,
      });

      // Log verification history
      await this.logVerificationHistory(
        orgId,
        companyId,
        evidence.id,
        'IMPORTED',
        'SOURCE_VERIFIED',
        'DIGITAL_SIGNATURE',
        'DIGILOCKER_NATIONAL_DEPOSITORY',
        doc.metadata,
      );

      importedRecords.push(updated || evidence);
    }

    await this.repository.updateCompany(companyId, {
      digilockerLinkedAt: now,
      digilockerMetadata: {
        digiLockerId: tokenRes.digiLockerId,
        signatoryName: tokenRes.name,
        importedDocumentsCount: importedRecords.length,
      },
      updatedAt: now,
    });

    return importedRecords;
  }

  /**
   * Human review of an evidence discrepancy.
   */
  public async reviewDiscrepancy(
    companyId: string,
    evidenceDocumentId: string,
    decision: 'ACCEPT_REGISTRY' | 'OVERRIDE_MANUAL' | 'REJECT',
    notes: string,
  ): Promise<schema.CompanyEvidenceDocument> {
    const orgId = this.requireOrg();
    const userId = TenantContextHolder.get()?.userId || 'usr_reviewer';
    const evidence = await this.companyEvidenceService.getEvidenceById(
      companyId,
      evidenceDocumentId,
    );

    const previousStatus = evidence.verificationStatus;
    const newStatus: schema.EvidenceVerificationStatus =
      decision === 'REJECT'
        ? schema.EvidenceVerificationStatus.REJECTED
        : schema.EvidenceVerificationStatus.SOURCE_VERIFIED;

    const now = new Date();
    const updated = await this.repository.updateEvidenceDocumentById(evidenceDocumentId, {
      verificationStatus: newStatus,
      verificationMethod: 'MANUAL_REVIEW',
      verifiedAt: now,
      verifiedBy: userId,
      discrepancyNotes: notes ? `Reviewed [${decision}]: ${notes}` : `Reviewed [${decision}]`,
      updatedAt: now,
    });

    await this.logVerificationHistory(
      orgId,
      companyId,
      evidenceDocumentId,
      previousStatus,
      newStatus,
      'MANUAL_REVIEW',
      userId,
      { decision, notes },
      notes,
    );

    return updated!;
  }

  /**
   * Get immutable verification audit history for a company.
   */
  public async getVerificationHistory(
    companyId: string,
  ): Promise<schema.EvidenceVerificationHistoryRecord[]> {
    const orgId = this.requireOrg();
    await this.getCompany(companyId, orgId);

    return this.repository.listVerificationHistory(companyId, orgId);
  }

  // --- Helper Methods ---

  private async recordEvidenceDocument(
    companyId: string,
    orgId: string,
    item: {
      evidenceType: string;
      fileName: string;
      issuer: string;
      referenceNumber: string;
      validFrom: Date | null;
      verificationStatus: schema.EvidenceVerificationStatus;
      verificationMethod: string;
      discrepancies: string[];
      rawPayload: Record<string, unknown>;
    },
  ) {
    const content = `%PDF-1.4\n%Verified-Evidence-${item.evidenceType}\nReference: ${item.referenceNumber}\nIssuer: ${item.issuer}\nDate: ${new Date().toISOString()}\n%%EOF`;
    const buffer = Buffer.from(content, 'utf-8');

    const created = await this.companyEvidenceService.uploadEvidence(companyId, {
      fileName: item.fileName,
      buffer,
      mimeType: 'application/pdf',
      evidenceType: item.evidenceType,
      issuer: item.issuer,
      referenceNumber: item.referenceNumber,
      validFrom: item.validFrom ? item.validFrom.toISOString() : undefined,
    });

    const now = new Date();
    await this.repository.updateEvidenceDocumentById(created.id, {
      verificationStatus: item.verificationStatus,
      verificationMethod: item.verificationMethod,
      verifiedAt: item.verificationStatus === 'SOURCE_VERIFIED' ? now : null,
      verifiedBy: `SYSTEM_${item.issuer.toUpperCase().replace(/\s+/g, '_')}`,
      discrepancyNotes: item.discrepancies.length > 0 ? item.discrepancies.join(' | ') : null,
      metadata: item.rawPayload,
      updatedAt: now,
    });

    await this.logVerificationHistory(
      orgId,
      companyId,
      created.id,
      'IMPORTED',
      item.verificationStatus,
      item.verificationMethod,
      `SYSTEM_${item.issuer}`,
      item.rawPayload,
      item.discrepancies.join(' | '),
    );
  }

  private async syncToProfile(
    companyId: string,
    patch: {
      company_name?: string;
      registrations?: Record<string, string>;
      operating_regions?: string[];
    },
    versionName: string,
  ) {
    const profile = await this.companyProfileService.getProfile(companyId);
    const existingPayload = profile.active?.payload || {
      company_name: patch.company_name || 'Enterprise',
    };

    const mergedPayload = {
      ...existingPayload,
      company_name: patch.company_name || existingPayload.company_name,
      registrations: {
        ...(existingPayload.registrations || {}),
        ...(patch.registrations || {}),
      },
      operating_regions: patch.operating_regions
        ? Array.from(
            new Set([...(existingPayload.operating_regions || []), ...patch.operating_regions]),
          )
        : existingPayload.operating_regions,
    };

    await this.companyProfileService.createProfileVersion(versionName, mergedPayload, companyId);
  }

  private async logVerificationHistory(
    orgId: string,
    companyId: string,
    evidenceDocumentId: string,
    previousStatus: string,
    newStatus: string,
    method: string,
    verifiedBy: string,
    payload?: Record<string, unknown>,
    notes?: string,
  ) {
    await this.repository.insertVerificationHistory({
      id: `evh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      organizationId: orgId,
      companyId,
      evidenceDocumentId,
      previousStatus,
      newStatus,
      verificationMethod: method,
      verifiedBy,
      verificationPayload: payload ?? null,
      discrepancyNotes: notes ?? null,
      timestamp: new Date(),
    });
  }

  private normalizeName(name?: string | null): string {
    if (!name) return '';
    return name
      .toUpperCase()
      .replace(/PRIVATE\s+LIMITED/g, '')
      .replace(/PVT\.?\s*LTD\.?/g, '')
      .replace(/LIMITED/g, '')
      .replace(/LTD\.?/g, '')
      .replace(/LLP/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }

  private async getCompany(companyId: string, orgId: string): Promise<schema.Company> {
    const comp = await this.repository.findCompany(companyId, orgId);

    if (!comp) {
      throw new NotFoundError(`Company '${companyId}' not found in your organization.`);
    }

    return comp;
  }

  private requireOrg(): string {
    const orgId = TenantContextHolder.get()?.organizationId;
    if (!orgId) throw new BadRequestError('Tenant context is required.');
    return orgId;
  }
}
