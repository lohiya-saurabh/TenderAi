import React, { useState } from 'react';
import { CompanyProfileHeader } from '../components/company/CompanyProfileHeader.js';
import { CapabilityNavTabs } from '../components/company/CapabilityNavTabs.js';
import { CompanyProfileView } from '../components/company/CompanyProfileView.js';
import {
  ENTERPRISE_COMPANY_PROFILE,
  type CapabilitySectionId,
} from '../components/company/companyProfileData.js';

export const CompanyProfilePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<CapabilitySectionId>('overview');
  const profile = ENTERPRISE_COMPANY_PROFILE;

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
