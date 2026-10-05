import React from 'react';
import type { CapabilitySectionId, FullCompanyProfile } from './companyProfileData.js';

export interface CapabilityNavTabsProps {
  activeSection: CapabilitySectionId;
  onSelectSection: (section: CapabilitySectionId) => void;
  profile: FullCompanyProfile;
}

interface SectionTabDef {
  id: CapabilitySectionId;
  label: string;
  icon: string;
  count: (p: FullCompanyProfile) => number;
  hasWarning?: (p: FullCompanyProfile) => boolean;
}

const SECTION_TABS: readonly SectionTabDef[] = [
  {
    id: 'overview',
    label: 'Company Overview',
    icon: '🏢',
    count: () => 1,
  },
  {
    id: 'registrations',
    label: 'Registrations',
    icon: '📜',
    count: (p) => p.registrations.length,
    hasWarning: (p) => p.registrations.some((r) => r.status === 'EXPIRING_SOON' || r.status === 'EXPIRED'),
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: '🏅',
    count: (p) => p.certifications.length,
    hasWarning: (p) => p.certifications.some((c) => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRED'),
  },
  {
    id: 'financials',
    label: 'Financials & UDIN',
    icon: '💰',
    count: (p) => p.turnoverRecords.length + p.solvencyRecords.length,
  },
  {
    id: 'experience',
    label: 'Past Experience',
    icon: '🏗️',
    count: (p) => p.pastExperience.length,
  },
  {
    id: 'projects',
    label: 'Major Projects',
    icon: '📋',
    count: (p) => p.projects.length,
  },
  {
    id: 'oem',
    label: 'OEM Relationships',
    icon: '🤝',
    count: (p) => p.oemAuthorizations.length,
  },
  {
    id: 'employees',
    label: 'Key Personnel',
    icon: '👷',
    count: (p) => p.employees.length,
  },
  {
    id: 'equipment',
    label: 'Plant & Equipment',
    icon: '🚜',
    count: (p) => p.equipment.length,
    hasWarning: (p) => p.equipment.some((eq) => eq.status === 'EXPIRING_SOON'),
  },
  {
    id: 'geography',
    label: 'Geographic Coverage',
    icon: '🗺️',
    count: (p) => p.geographicCoverage.length,
  },
  {
    id: 'evidence',
    label: 'Evidence Vault',
    icon: '📁',
    count: (p) => p.evidenceVault.length,
  },
];

export const CapabilityNavTabs: React.FC<CapabilityNavTabsProps> = ({
  activeSection,
  onSelectSection,
  profile,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '0.4rem',
        padding: '0.25rem 0',
        borderBottom: '1px solid var(--color-surface-border)',
        scrollbarWidth: 'thin',
      }}
    >
      {SECTION_TABS.map((tab) => {
        const isActive = activeSection === tab.id;
        const itemCount = tab.count(profile);
        const warn = tab.hasWarning?.(profile);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectSection(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.65rem 0.95rem',
              border: 'none',
              borderBottom: isActive ? '3px solid var(--color-primary-500)' : '3px solid transparent',
              backgroundColor: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              color: isActive ? 'var(--color-primary-300)' : 'var(--color-surface-muted)',
              fontSize: 'var(--text-xs)',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                padding: '0.1rem 0.4rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isActive
                  ? 'var(--color-primary-500)'
                  : warn
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'var(--color-surface-bg)',
                color: isActive
                  ? '#ffffff'
                  : warn
                    ? 'var(--color-warning)'
                    : 'var(--color-surface-muted)',
                border: `1px solid ${warn ? 'rgba(245, 158, 11, 0.4)' : 'var(--color-surface-border)'}`,
              }}
            >
              {itemCount}
              {warn && ' ⚠️'}
            </span>
          </button>
        );
      })}
    </div>
  );
};
