import React, { useState, useMemo } from 'react';
import { useCompany } from '../context/CompanyContext.js';
import { CompanyProfileHeader } from '../components/company/CompanyProfileHeader.js';
import { CapabilityNavTabs } from '../components/company/CapabilityNavTabs.js';
import { CompanyProfileView } from '../components/company/CompanyProfileView.js';
import { Card, CardContent } from '../components/ui/card.js';
import { Building2 } from 'lucide-react';
import type {
  CapabilitySectionId,
  FullCompanyProfile,
  RegistrationItem,
} from '../components/company/companyProfileData.js';

export const CompanyProfilePage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [activeSection, setActiveSection] = useState<CapabilitySectionId>('overview');

  const profile = useMemo<FullCompanyProfile | null>(() => {
    if (!selectedCompany) return null;

    const registrations: RegistrationItem[] = [];
    if (selectedCompany.gstin) {
      registrations.push({
        id: 'reg-gstin',
        title: 'Goods & Services Tax (GSTIN)',
        regType: 'GSTIN',
        regNumber: selectedCompany.gstin,
        issuingAuthority: 'Goods & Services Tax Network (GSTN)',
        stateOrJurisdiction: 'India',
        status: 'VERIFIED',
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
    if (selectedCompany.udyamId) {
      registrations.push({
        id: 'reg-udyam',
        title: 'MSME Udyam Registration',
        regType: 'UDYAM',
        regNumber: selectedCompany.udyamId,
        issuingAuthority: 'Ministry of MSME, Govt of India',
        stateOrJurisdiction: 'India',
        status: 'VERIFIED',
      });
    }

    return {
      companyId: selectedCompany.id,
      companyName: selectedCompany.legalName,
      legalEntityName: selectedCompany.legalName,
      cinNumber: '—',
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
      evidenceVault: [],
    };
  }, [selectedCompany]);

  if (!profile) {
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
