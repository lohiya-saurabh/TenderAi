import React, { useState, useEffect } from 'react';
import { CapabilityItemCard } from '@/components/company/CapabilityItemCard.js';
import { CapabilityEmptyState } from '@/components/company/CapabilityEmptyState.js';
import { StatutoryProfileCard } from '@/components/company/StatutoryProfileCard.js';
import { EvidenceVaultSection } from '@/components/company/EvidenceVaultSection.js';
import { EvidencePreviewDrawer } from '@/components/company/EvidencePreviewDrawer.js';
import { FinancialsSection } from '@/components/company/FinancialsSection.js';
import {
  type FullCompanyProfile,
  type CapabilitySectionId,
  type CapabilityStatus,
  type EvidenceVaultItem,
} from '@/components/company/companyProfileData.js';
import { getCompanyEvidenceDownloadUrl } from '@/api/companies.js';
import { getAccessToken } from '@/api/client.js';
import {
  Search,
  X,
  ShieldCheck,
  Award,
  FileCheck2,
  Briefcase,
  Users,
  Wrench,
  MapPin,
} from 'lucide-react';
import { enumLabel } from '@/lib/utils.js';

export interface CompanyProfileViewProps {
  profile: FullCompanyProfile;
  activeSection: CapabilitySectionId;
  onUploadEvidence?: () => void;
  onImportCloud?: () => void;
}

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({
  profile,
  activeSection,
  onUploadEvidence,
  onImportCloud,
}) => {
  const [selectedDocPreview, setSelectedDocPreview] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CapabilityStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');


  const matchedDoc = profile.evidenceVault.find(
    (d) => d.id === selectedDocPreview || d.fileName === selectedDocPreview,
  );
  const activeDocTitle = matchedDoc?.fileName || selectedDocPreview;

  useEffect(() => {
    if (!selectedDocPreview) {
      setPreviewUrl(null);
      return;
    }
    let isMounted = true;
    setIsPreviewLoading(true);
    const docId = matchedDoc?.id || selectedDocPreview;

    getCompanyEvidenceDownloadUrl(profile.companyId, docId)
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data.downloadUrl) {
          setPreviewUrl(res.data.downloadUrl);
        } else {
          const token = getAccessToken();
          const query = new URLSearchParams({ disposition: 'inline' });
          if (token) query.set('token', token);
          setPreviewUrl(
            `/api/v1/companies/${encodeURIComponent(profile.companyId)}/evidence/${encodeURIComponent(docId)}/download?${query.toString()}`,
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const token = getAccessToken();
        const query = new URLSearchParams({ disposition: 'inline' });
        if (token) query.set('token', token);
        setPreviewUrl(
            `/api/v1/companies/${encodeURIComponent(profile.companyId)}/evidence/${encodeURIComponent(docId)}/download?${query.toString()}`,
        );
      })
      .finally(() => {
        if (isMounted) setIsPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDocPreview, profile.companyId, matchedDoc?.id]);

  const handleDownloadEvidence = async (docOrId: EvidenceVaultItem | string) => {
    const docId = typeof docOrId === 'string' ? docOrId : docOrId.id;
    const fileName = typeof docOrId === 'string' ? docOrId : docOrId.fileName;
    setDownloadingDocId(docId);
    try {
      const res = await getCompanyEvidenceDownloadUrl(profile.companyId, docId);
      if (res.ok && res.data.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      } else {
        const token = getAccessToken();
        const query = new URLSearchParams({
          fileName,
          disposition: 'attachment',
        });
        if (token) query.set('token', token);
        window.open(
          `/api/v1/companies/${encodeURIComponent(profile.companyId)}/evidence/${encodeURIComponent(docId)}/download?${query.toString()}`,
          '_blank',
        );
      }
    } catch {
      const token = getAccessToken();
      const query = new URLSearchParams({
        fileName,
        disposition: 'attachment',
      });
      if (token) query.set('token', token);
      window.open(
        `/api/v1/companies/${encodeURIComponent(profile.companyId)}/evidence/${encodeURIComponent(docId)}/download?${query.toString()}`,
        '_blank',
      );
    } finally {
      setDownloadingDocId(null);
    }
  };


  const filteredRegistrations = profile.registrations
    .filter((r) => filterStatus === 'ALL' || r.status === filterStatus)
    .filter(
      (r) =>
        !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.regNumber.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const filteredCertifications = profile.certifications
    .filter((c) => filterStatus === 'ALL' || c.status === filterStatus)
    .filter(
      (c) =>
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const filteredTurnovers = profile.turnoverRecords
    .filter((t) => filterStatus === 'ALL' || t.status === filterStatus)
    .filter(
      (t) =>
        !searchQuery ||
        t.financialYear.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.caUdin.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const filteredExperience = profile.pastExperience
    .filter((e) => filterStatus === 'ALL' || e.status === filterStatus)
    .filter(
      (e) =>
        !searchQuery ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.clientName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Toolbar — only shown on credential item sections */}
      {activeSection !== 'overview' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search credentials, UDINs, standards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-lg pl-8 pr-8 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-2xs font-semibold text-muted-foreground mr-1">
              Filter:
            </span>
            {(['ALL', 'VERIFIED', 'EXPIRING_SOON', 'EXPIRED', 'NEEDS_REVIEW'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    filterStatus === st
                      ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/50 font-medium'
                  }`}
                >
                  {st === 'ALL' ? 'All' : enumLabel(st)}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* 1. OVERVIEW SECTION */}
      {activeSection === 'overview' && <StatutoryProfileCard profile={profile} />}

      {/* 2. REGISTRATIONS */}
      {activeSection === 'registrations' && (
        <div className="flex flex-col gap-3.5">
          {filteredRegistrations.length === 0 ? (
            <CapabilityEmptyState
              icon={ShieldCheck}
              title="No statutory registrations added"
              description="Add your GSTIN, PAN, CIN, or Udyam registrations to verify your corporate entity and establish eligibility for government tenders."
              actionLabel="Upload evidence"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            filteredRegistrations.map((reg) => (
              <CapabilityItemCard
                key={reg.id}
                item={reg}
                typeBadge={reg.regType}
                expiryDate={reg.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Registration / license №',
                    value: reg.regNumber,
                    isMono: true,
                    highlight: true,
                  },
                  { label: 'Issuing authority', value: reg.issuingAuthority },
                  { label: 'Jurisdiction / state', value: reg.stateOrJurisdiction || 'National' },
                  { label: 'Last verified', value: reg.lastVerifiedAt || '2026-09-01' },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 3. CERTIFICATIONS */}
      {activeSection === 'certifications' && (
        <div className="flex flex-col gap-3.5">
          {filteredCertifications.length === 0 ? (
            <CapabilityEmptyState
              icon={Award}
              title="No ISO or quality certifications added"
              description="Upload your ISO 9001:2015, ISO 14001, or ISO 45001 certificates from your device or evidence vault to fulfill technical quality prequalification."
              actionLabel="Upload certification"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            filteredCertifications.map((cert) => (
              <CapabilityItemCard
                key={cert.id}
                item={cert}
                typeBadge={cert.standard}
                expiryDate={cert.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Certificate number',
                    value: cert.certificateNumber,
                    isMono: true,
                    highlight: true,
                  },
                  { label: 'Accredited registrar', value: cert.issuingBody },
                  { label: 'Valid From', value: cert.validFrom },
                  { label: 'Certified scope', value: cert.scopeSummary },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 4. FINANCIALS & UDIN */}
      {activeSection === 'financials' && (
        <FinancialsSection
          turnoverRecords={filteredTurnovers}
          solvencyRecords={profile.solvencyRecords}
          onUploadEvidence={onUploadEvidence}
          onSelectDocPreview={(doc) => setSelectedDocPreview(doc)}
        />
      )}

      {/* 5. PAST EXPERIENCE (7-YEAR QUALIFYING PROJECTS) */}
      {activeSection === 'experience' && (
        <div className="flex flex-col gap-3.5">
          {filteredExperience.length === 0 ? (
            <CapabilityEmptyState
              icon={FileCheck2}
              title="No past experience projects recorded"
              description="Upload client work orders, completion certificates, or commercial operation declarations to verify qualifying similar works."
              actionLabel="Upload work order / completion certificate"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            filteredExperience.map((exp) => (
              <CapabilityItemCard
                key={exp.id}
                item={exp}
                typeBadge={exp.clientType}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Executed contract value',
                    value: `₹${exp.contractValueInrCrores.toFixed(2)} Cr`,
                    highlight: true,
                  },
                  { label: 'Procuring client', value: exp.clientName },
                  { label: 'Completion date', value: exp.completionDate },
                  { label: 'State / location', value: exp.locationState },
                  {
                    label: 'Scope & work highlights',
                    value: (
                      <ul className="list-disc pl-4">
                        {exp.scopeHighlights.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 6. MAJOR PROJECTS */}
      {activeSection === 'projects' && (
        <div className="flex flex-col gap-3.5">
          {profile.projects.length === 0 ? (
            <CapabilityEmptyState
              icon={Briefcase}
              title="No ongoing major projects recorded"
              description="Add ongoing project contracts to accurately calculate available bid capacity and active commitment commitments."
              actionLabel="Upload evidence"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            profile.projects.map((proj) => (
              <CapabilityItemCard
                key={proj.id}
                item={proj}
                typeBadge={proj.role.replace(/_/g, ' ')}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Project name', value: proj.projectName, highlight: true },
                  { label: 'Client / authority', value: proj.clientName },
                  {
                    label: 'Contract value',
                    value: `₹${proj.contractValueInrCrores.toFixed(2)} Cr`,
                    highlight: true,
                  },
                  { label: 'Execution period', value: `${proj.startDate} to ${proj.endDate}` },
                  { label: 'Key deliverables', value: proj.keyDeliverables },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 7. OEM RELATIONSHIPS & MAFs */}
      {activeSection === 'oem' && (
        <div className="flex flex-col gap-3.5">
          {profile.oemAuthorizations.length === 0 ? (
            <CapabilityEmptyState
              icon={Award}
              title="No OEM authorizations recorded"
              description="Upload Manufacturer Authorization Forms (MAFs) or dealership certificates to satisfy equipment supply requirements."
              actionLabel="Upload OEM MAF"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            profile.oemAuthorizations.map((oem) => (
              <CapabilityItemCard
                key={oem.id}
                item={oem}
                typeBadge={oem.partnerTier}
                expiryDate={oem.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'OEM Brand', value: oem.oemName, highlight: true },
                  { label: 'Authorized product lines', value: oem.productCategories.join(', ') },
                  { label: 'Authorized territory', value: oem.authorizedTerritory },
                  { label: 'Valid From', value: oem.validFrom },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 8. KEY PERSONNEL & STAFF */}
      {activeSection === 'employees' && (
        <div className="flex flex-col gap-3.5">
          {profile.employees.length === 0 ? (
            <CapabilityEmptyState
              icon={Users}
              title="No key personnel recorded"
              description="Add certified project directors, structural engineers, or safety officers to meet tender technical personnel criteria."
              actionLabel="Upload evidence"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            profile.employees.map((emp) => (
              <CapabilityItemCard
                key={emp.id}
                item={emp}
                typeBadge={emp.role.replace(/_/g, ' ')}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Full name & designation',
                    value: `${emp.name} — ${emp.designation}`,
                    highlight: true,
                  },
                  { label: 'Technical qualification', value: emp.qualification },
                  { label: 'Experience in sector', value: `${emp.experienceYears} years` },
                  { label: 'EPFO UAN Reference', value: emp.epfoUan || 'N/A', isMono: true },
                  {
                    label: 'Key personnel status',
                    value: emp.isKeyPersonnel ? 'Key personnel' : 'Supporting staff',
                  },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 9. PLANT & EQUIPMENT */}
      {activeSection === 'equipment' && (
        <div className="flex flex-col gap-3.5">
          {profile.equipment.length === 0 ? (
            <CapabilityEmptyState
              icon={Wrench}
              title="No equipment or plant assets recorded"
              description="Add owned or leased heavy equipment, rotary piling rigs, or automated batching plants to fulfill mobilization conditions."
              actionLabel="Upload evidence"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            profile.equipment.map((eq) => (
              <CapabilityItemCard
                key={eq.id}
                item={eq}
                typeBadge={`${eq.ownership} (${eq.quantity} Units)`}
                expiryDate={eq.calibrationValidUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Equipment model & make', value: eq.modelAndMake, highlight: true },
                  { label: 'Equipment category', value: eq.equipmentType },
                  { label: 'Rating / capacity', value: eq.capacityOrRating },
                  { label: 'Year of manufacture', value: eq.manufactureYear },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 10. GEOGRAPHIC COVERAGE */}
      {activeSection === 'geography' && (
        <div className="flex flex-col gap-3.5">
          {profile.geographicCoverage.length === 0 ? (
            <CapabilityEmptyState
              icon={MapPin}
              title="No geographic facilities recorded"
              description="Add corporate headquarters, regional offices, or project site offices to verify local presence requirements."
              actionLabel="Upload evidence"
              onAction={onUploadEvidence}
              actionIcon="upload"
            />
          ) : (
            profile.geographicCoverage.map((geo) => (
              <CapabilityItemCard
                key={geo.id}
                item={geo}
                typeBadge={geo.facilityType.replace(/_/g, ' ')}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Facility address',
                    value: `${geo.address}, ${geo.city}, ${geo.state}`,
                    highlight: true,
                  },
                  { label: 'Committed SLA response', value: `< ${geo.slaResponseHours} hours` },
                  {
                    label: 'Resident staff strength',
                    value: `${geo.serviceStaffCount} technical staff`,
                  },
                ]}
              />
            ))
          )}
        </div>
      )}

      {/* 11. EVIDENCE VAULT */}
      {activeSection === 'evidence' && (
        <EvidenceVaultSection
          evidenceVault={profile.evidenceVault}
          onUploadEvidence={onUploadEvidence}
          onImportCloud={onImportCloud}
          onSelectDocPreview={(fileName) => setSelectedDocPreview(fileName)}
          onDownloadEvidence={handleDownloadEvidence}
          downloadingDocId={downloadingDocId}
        />
      )}

      {/* Document Preview Drawer (780px streaming PDF preview) */}
      <EvidencePreviewDrawer
        isOpen={Boolean(selectedDocPreview)}
        onClose={() => {
          setSelectedDocPreview(null);
          setPreviewUrl(null);
        }}
        activeDocTitle={activeDocTitle}
        matchedDoc={matchedDoc}
        previewUrl={previewUrl}
        isPreviewLoading={isPreviewLoading}
        downloadingDocId={downloadingDocId}
        onDownloadEvidence={handleDownloadEvidence}
      />

      {/* Add Credential Modal */}
    </div>
  );
};
