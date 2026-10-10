import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCompany } from '../context/CompanyContext.js';
import { CompanyProfileHeader } from '../components/company/CompanyProfileHeader.js';
import { CapabilityNavTabs } from '../components/company/CapabilityNavTabs.js';
import { CompanyProfileView } from '../components/company/CompanyProfileView.js';
import { CompanyVerificationBar } from '../components/company/CompanyVerificationBar.js';
import { Card, CardContent } from '../components/ui/card.js';
import { Building2 } from 'lucide-react';
import { listCompanyEvidence, type EvidenceDocumentItem } from '../api/companies.js';
import type {
  CapabilitySectionId,
  FullCompanyProfile,
  RegistrationItem,
  EvidenceVaultItem,
} from '../components/company/companyProfileData.js';

export const CompanyProfilePage: React.FC = () => {
  const { selectedCompany, reloadCompanies } = useCompany();
  const [activeSection, setActiveSection] = useState<CapabilitySectionId>('overview');
  const [evidenceList, setEvidenceList] = useState<EvidenceDocumentItem[]>([]);

  const fetchEvidence = useCallback(async () => {
    if (selectedCompany?.id) {
      const res = await listCompanyEvidence(selectedCompany.id);
      if (res.ok) {
        setEvidenceList(res.data);
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
      sha256Hash: doc.sha256Hash,
      linkedCapabilitiesCount: 1,
      verificationStatus: doc.verificationStatus,
    }));

    return {
      companyId: selectedCompany.id,
      companyName: selectedCompany.legalName,
      legalEntityName: selectedCompany.legalName,
      cinNumber: selectedCompany.cin || '—',
      incorporationDate: selectedCompany.createdAt ? selectedCompany.createdAt.split('T')[0]! : '—',
      profileVersion: 'v1.0 (Active Baseline)',
      msmeCategory: 'SMALL',
      msmeType: 'CONSTRUCTION_INFRA',
      isBlacklisted: false,
      creditRating: {
        agency: 'CRISIL / CARE',
        rating: 'Investment Grade',
        validUntil: '2027-03-31',
      },
      registrations,
      certifications: [],
      turnoverRecords: [],
      solvencyRecords: [],
      pastExperience: [],
      projects: [],
      oemAuthorizations: [],
      employees: [],
      equipment: [],
      geographicCoverage: [],
      evidenceVault,
    };
  }, [selectedCompany, evidenceList]);

  if (!profile || !selectedCompany) {
    return (
      <Card className="p-8 text-center border-dashed border-border/80">
        <CardContent className="flex flex-col items-center gap-2">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">No Company Selected</h3>
          <p className="text-xs text-muted-foreground">Please select or register a company entity to view its capability profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
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
      />
    </div>
  );
};

