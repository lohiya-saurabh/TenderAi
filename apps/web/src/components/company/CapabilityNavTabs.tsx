import React from 'react';
import {
  Building2,
  FileText,
  Award,
  TrendingUp,
  Briefcase,
  Layers,
  Handshake,
  Users,
  Wrench,
  MapPin,
  FolderArchive,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { CapabilitySectionId, FullCompanyProfile } from './companyProfileData.js';

export interface CapabilityNavTabsProps {
  activeSection: CapabilitySectionId;
  onSelectSection: (section: CapabilitySectionId) => void;
  profile: FullCompanyProfile;
}

interface SectionTabDef {
  id: CapabilitySectionId;
  label: string;
  icon: LucideIcon;
  count: (p: FullCompanyProfile) => number;
  hasWarning?: (p: FullCompanyProfile) => boolean;
}

const SECTION_TABS: readonly SectionTabDef[] = [
  {
    id: 'overview',
    label: 'Company Overview',
    icon: Building2,
    count: () => 1,
  },
  {
    id: 'registrations',
    label: 'Registrations',
    icon: FileText,
    count: (p) => p.registrations.length,
    hasWarning: (p) => p.registrations.some((r) => r.status === 'EXPIRING_SOON' || r.status === 'EXPIRED'),
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: Award,
    count: (p) => p.certifications.length,
    hasWarning: (p) => p.certifications.some((c) => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRED'),
  },
  {
    id: 'financials',
    label: 'Financials & UDIN',
    icon: TrendingUp,
    count: (p) => p.turnoverRecords.length + p.solvencyRecords.length,
  },
  {
    id: 'experience',
    label: 'Past Experience',
    icon: Briefcase,
    count: (p) => p.pastExperience.length,
  },
  {
    id: 'projects',
    label: 'Major Projects',
    icon: Layers,
    count: (p) => p.projects.length,
  },
  {
    id: 'oem',
    label: 'OEM Relationships',
    icon: Handshake,
    count: (p) => p.oemAuthorizations.length,
  },
  {
    id: 'employees',
    label: 'Key Personnel',
    icon: Users,
    count: (p) => p.employees.length,
  },
  {
    id: 'equipment',
    label: 'Plant & Equipment',
    icon: Wrench,
    count: (p) => p.equipment.length,
    hasWarning: (p) => p.equipment.some((eq) => eq.status === 'EXPIRING_SOON'),
  },
  {
    id: 'geography',
    label: 'Geographic Coverage',
    icon: MapPin,
    count: (p) => p.geographicCoverage.length,
  },
  {
    id: 'evidence',
    label: 'Evidence Vault',
    icon: FolderArchive,
    count: (p) => p.evidenceVault.length,
  },
];

export const CapabilityNavTabs: React.FC<CapabilityNavTabsProps> = ({
  activeSection,
  onSelectSection,
  profile,
}) => {
  return (
    <nav
      aria-label="Company Capability Sections"
      className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border scrollbar-thin w-full"
    >
      {SECTION_TABS.map((tab) => {
        const isActive = activeSection === tab.id;
        const itemCount = tab.count(profile);
        const warn = tab.hasWarning?.(profile);
        const IconComponent = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectSection(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
              isActive
                ? 'border-primary bg-primary/5 text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <IconComponent size={14} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
            <span>{tab.label}</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : warn
                    ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800'
                    : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {itemCount}
              {warn && <AlertTriangle size={10} className="text-orange-600 dark:text-orange-400 shrink-0" />}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
