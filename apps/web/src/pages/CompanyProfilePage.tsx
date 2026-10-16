import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCompany } from '@/context/useCompany.js';
import { CompanyProfileHeader } from '@/components/company/CompanyProfileHeader.js';
import { CapabilityNavTabs } from '@/components/company/CapabilityNavTabs.js';
import { CompanyProfileView } from '@/components/company/CompanyProfileView.js';
import { CompanyVerificationBar } from '@/components/company/CompanyVerificationBar.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Building2 } from 'lucide-react';
import { listCompanyEvidence, getCompanyProfile, type EvidenceDocumentItem } from '@/api/companies.js';
import type { CompanyProfileView as ApiCompanyProfileView } from '@/api/companyProfile.js';
import type {
  CapabilitySectionId,
  FullCompanyProfile,
  RegistrationItem,
  EvidenceVaultItem,
  FinancialTurnoverItem,
  SolvencyItem,
  ExperienceItem,
  CertificationItem,
  OemAuthorizationItem,
  EmployeeItem,
  EquipmentItem,
} from '@/components/company/companyProfileData.js';

export const CompanyProfilePage: React.FC = () => {
  const { selectedCompany, reloadCompanies } = useCompany();
  const [activeSection, setActiveSection] = useState<CapabilitySectionId>('overview');
  const [evidenceList, setEvidenceList] = useState<EvidenceDocumentItem[]>([]);
  const [apiProfile, setApiProfile] = useState<ApiCompanyProfileView | null>(null);
  const [openEvidenceTrigger, setOpenEvidenceTrigger] = useState(0);
  const [evidenceSourceDefault, setEvidenceSourceDefault] = useState<'DEVICE' | 'GOOGLE_DRIVE' | 'ONEDRIVE'>('DEVICE');

  const fetchEvidence = useCallback(async () => {
    if (selectedCompany?.id) {
      const [res, profRes] = await Promise.all([
        listCompanyEvidence(selectedCompany.id),
        getCompanyProfile(selectedCompany.id),
      ]);
      if (res.ok) {
        setEvidenceList(res.data);
      }
      if (profRes.ok && profRes.data) {
        setApiProfile(profRes.data);
      }
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleRefreshAll = async () => {
    await reloadCompanies();
    await fetchEvidence();
  };

  const profile = useMemo<FullCompanyProfile | null>(() => {
    if (!selectedCompany) return null;

    const registrations: RegistrationItem[] = [];
    if (selectedCompany.gstin) {
      const isGstVerified = Boolean(selectedCompany.gstinVerifiedAt);
      registrations.push({
        id: 'reg-gstin',
        title: 'Goods & Services Tax (GSTIN)',
        regType: 'GSTIN',
        regNumber: selectedCompany.gstin,
        issuingAuthority: 'Goods & Services Tax Network (GSTN)',
        stateOrJurisdiction: 'India',
        status: isGstVerified ? 'SOURCE_VERIFIED' : 'VERIFIED',
        verificationNotes: isGstVerified ? 'Verified via IRIS IRP GSP' : undefined,
        lastVerifiedAt: selectedCompany.gstinVerifiedAt || undefined,
      });
    }
    if (selectedCompany.pan) {
      registrations.push({
        id: 'reg-pan',
        title: 'Permanent Account Number (PAN)',
        regType: 'PAN',
        regNumber: selectedCompany.pan,
        issuingAuthority: 'Income Tax Department of India',
        stateOrJurisdiction: 'Pan-India',
        status: 'VERIFIED',
      });
    }
    if (selectedCompany.cin) {
      const isMcaVerified = Boolean(selectedCompany.mcaVerifiedAt);
      registrations.push({
        id: 'reg-cin',
        title: 'Ministry of Corporate Affairs (CIN)',
        regType: 'CPPP',
        regNumber: selectedCompany.cin,
        issuingAuthority: 'Ministry of Corporate Affairs (MCA)',
        stateOrJurisdiction: 'India',
        status: isMcaVerified ? 'SOURCE_VERIFIED' : 'VERIFIED',
        verificationNotes: isMcaVerified ? 'Verified via MCA Master Data' : undefined,
        lastVerifiedAt: selectedCompany.mcaVerifiedAt || undefined,
      });
    }
    if (selectedCompany.udyamId) {
      const isUdyamVerified = Boolean(selectedCompany.udyamVerifiedAt);
      registrations.push({
        id: 'reg-udyam',
        title: 'MSME Udyam Registration',
        regType: 'UDYAM',
        regNumber: selectedCompany.udyamId,
        issuingAuthority: 'Ministry of MSME, Govt of India',
        stateOrJurisdiction: 'India',
        status: isUdyamVerified ? 'SOURCE_VERIFIED' : 'VERIFIED',
        verificationNotes: isUdyamVerified ? 'Verified via MSME National Portal' : undefined,
        lastVerifiedAt: selectedCompany.udyamVerifiedAt || undefined,
      });
    }

    const evidenceVault: EvidenceVaultItem[] = evidenceList.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      docType: doc.evidenceType,
      uploadedAt: doc.importedAt || doc.createdAt,
      expiryDate: doc.validTo,
      validTo: doc.validTo,
      sha256Hash: doc.sha256Hash,
      linkedCapabilitiesCount: 1,
      verificationStatus: doc.verificationStatus,
      issuer: doc.issuer,
      referenceNumber: doc.referenceNumber,
      validFrom: doc.validFrom,
      extractedAttributes: doc.extractedAttributes,
    }));

    const payload = apiProfile?.active?.payload;

    const turnoverRecords: FinancialTurnoverItem[] = (payload?.turnover_records ?? []).map((t) => ({
      id: t.entry_id,
      title: `${t.financial_year || 'FY'} Audited Financial Turnover`,
      financialYear: t.financial_year || '',
      turnoverInrCrores: Number(t.turnover_inr_crores) || 0,
      netWorthInrCrores: 0,
      caFirmName: 'Statutory Auditor',
      caMembershipNo: '',
      caUdin: t.ca_udin || '',
      isUdinValidated: Boolean(t.ca_udin),
      audited: true,
      status: 'VERIFIED',
      evidenceDocId: t.evidence_document_id,
    }));

    const certifications: CertificationItem[] = (payload?.certifications ?? []).map((c) => ({
      id: c.entry_id,
      title: `${c.standard_name} Certification`,
      standard: c.standard_name,
      issuingBody: c.issuing_body,
      certificateNumber: c.entry_id,
      validFrom: c.valid_from,
      validUntil: c.valid_to || '',
      scopeSummary: `${c.standard_name} Quality Management Scope`,
      status: 'VERIFIED',
      evidenceDocId: c.evidence_document_id,
    }));

    const pastExperience: ExperienceItem[] = (payload?.experience ?? []).map((e) => ({
      id: e.entry_id,
      title: e.project_name,
      projectTitle: e.project_name,
      clientName: e.client_name,
      clientType: 'CENTRAL_GOVT',
      contractValueInrCrores: Number(e.contract_value_inr_crores) || 0,
      completionDate: e.completion_date,
      locationState: e.location_state,
      scopeHighlights: e.work_type_tags || ['Infrastructure EPC Works'],
      workTypeTags: e.work_type_tags || [],
      status: 'VERIFIED',
      evidenceDocId: e.evidence_document_id,
    }));

    const oemAuthorizations: OemAuthorizationItem[] = (payload?.oem_authorizations ?? []).map((o) => ({
      id: o.entry_id,
      title: `${o.oem_name} Authorization`,
      oemName: o.oem_name,
      partnerTier: 'Authorized Partner',
      productCategories: o.product_lines || [],
      authorizedTerritory: 'National',
      validFrom: o.valid_from,
      validUntil: o.valid_to,
      mafDocName: '',
      status: 'VERIFIED',
      evidenceDocId: o.evidence_document_id,
    }));

    const employees: EmployeeItem[] = (payload?.staff ?? []).map((s) => ({
      id: s.entry_id,
      title: s.name,
      name: s.name,
      designation: s.role,
      role: 'PROJECT_MANAGER',
      qualification: s.qualification,
      experienceYears: s.experience_years,
      isKeyPersonnel: true,
      status: 'VERIFIED',
      evidenceDocId: s.evidence_document_id,
    }));

    const equipment: EquipmentItem[] = (payload?.equipment ?? []).map((eq) => ({
      id: eq.entry_id,
      title: eq.name,
      name: eq.name,
      modelAndMake: eq.name,
      equipmentType: eq.equipment_type,
      quantity: eq.quantity,
      ownership: eq.owned ? 'OWNED' : 'LEASED',
      manufactureYear: 2022,
      capacityOrRating: 'Heavy Machinery',
      status: 'VERIFIED',
      evidenceDocId: eq.evidence_document_id,
    }));

    const solvencyRecords: SolvencyItem[] =
      (payload?.solvency_records && payload.solvency_records.length > 0)
        ? payload.solvency_records.map((s) => ({
            id: s.entry_id,
            title: `${s.bank_name || 'Bank'} Solvency Certificate`,
            bankName: s.bank_name || 'Scheduled Commercial Bank',
            solvencyLimitInrCrores: Number(s.solvency_limit_inr_crores) || 0,
            sanctionDate: s.sanction_date || '',
            validUntil: s.valid_until || '',
            accountNumberMasked: s.account_number_masked || 'XXXX-XXXX-XXXX',
            status: 'VERIFIED',
            evidenceDocId: s.evidence_document_id || undefined,
          }))
        : evidenceList
            .filter((d) => d.evidenceType === 'SOLVENCY_CERT')
            .map((d) => {
              const attrs = (d.extractedAttributes || {}) as Record<string, unknown>;
              return {
                id: d.id,
                title: `${d.issuer || 'Bank'} Solvency Certificate`,
                bankName: d.issuer || 'Scheduled Commercial Bank',
                solvencyLimitInrCrores: Number(attrs.solvency_limit_inr_crores) || 0,
                sanctionDate: d.validFrom ? d.validFrom.split('T')[0]! : '',
                validUntil: d.validTo ? d.validTo.split('T')[0]! : '',
                accountNumberMasked: d.referenceNumber || 'XXXX-XXXX-XXXX',
                status: 'VERIFIED',
                evidenceDocId: d.id,
              };
            });

    const creditRating = payload?.credit_rating
      ? {
          agency: payload.credit_rating.agency,
          rating: payload.credit_rating.rating,
          validUntil: payload.credit_rating.valid_until || undefined,
        }
      : (() => {
          const solvDoc = evidenceList.find((d) => d.evidenceType === 'SOLVENCY_CERT');
          const attrs = (solvDoc?.extractedAttributes || {}) as Record<string, unknown>;
          if (attrs?.rating) {
            return {
              agency: String(attrs.agency || solvDoc?.issuer || 'Credit Rating Agency'),
              rating: String(attrs.rating),
              validUntil: solvDoc?.validTo ? solvDoc.validTo.split('T')[0] : undefined,
            };
          }
          return null;
        })();

    const mcaData = (selectedCompany.mcaVerificationData || {}) as Record<string, unknown>;
    const cinYearMatch = selectedCompany.cin ? selectedCompany.cin.match(/[A-Za-z]{2}(\d{4})[A-Za-z]{3}/) : null;
    const derivedIncorporation =
      (mcaData.incorporationDate as string) ||
      (mcaData.incorporation_date as string) ||
      (cinYearMatch ? cinYearMatch[1] : null) ||
      '—';

    return {
      companyId: selectedCompany.id,
      companyName: selectedCompany.legalName,
      legalEntityName: selectedCompany.legalName,
      cinNumber: selectedCompany.cin || '—',
      incorporationDate: derivedIncorporation,
      profileVersion: apiProfile?.active ? `v${apiProfile.active.version}.0 (Active)` : 'v1.0 (Clean Baseline)',
      msmeCategory: selectedCompany.udyamId ? 'SMALL' : 'LARGE ENTERPRISE',
      msmeType: 'CONSTRUCTION_INFRA',
      isBlacklisted: false,
      creditRating,
      registrations,
      certifications,
      turnoverRecords,
      solvencyRecords,
      pastExperience,
      projects: [],
      oemAuthorizations,
      employees,
      equipment,
      geographicCoverage: [],
      evidenceVault,
    };
  }, [selectedCompany, evidenceList, apiProfile]);

  if (!profile || !selectedCompany) {
    return (
      <Card className="p-8 text-center border-dashed border-border/80">
        <CardContent className="flex flex-col items-center gap-2">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">No Company Selected</h3>
          <p className="text-xs text-muted-foreground">
            Please select or register a company entity to view its capability profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Profile Header & Health Summary */}
      <CompanyProfileHeader
        profile={profile}
        onOpenVault={() => setActiveSection('evidence')}
        onAddCredential={() => setActiveSection('overview')}
      />

      {/* Third-Party Verification Hub (IRIS IRP, MCA, Udyam, DigiLocker, Cloud Drive) */}
      <CompanyVerificationBar
        company={selectedCompany}
        onRefresh={handleRefreshAll}
        openEvidenceModalTrigger={openEvidenceTrigger}
        defaultEvidenceSource={evidenceSourceDefault}
      />

      {/* 11-Section Tab Navigation */}
      <CapabilityNavTabs
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        profile={profile}
      />

      {/* Active Section Content */}
      <CompanyProfileView
        profile={profile}
        activeSection={activeSection}
        onUploadEvidence={() => {
          setEvidenceSourceDefault('DEVICE');
          setOpenEvidenceTrigger(Date.now());
        }}
        onImportCloud={() => {
          setEvidenceSourceDefault('GOOGLE_DRIVE');
          setOpenEvidenceTrigger(Date.now());
        }}
      />
    </div>
  );
};
