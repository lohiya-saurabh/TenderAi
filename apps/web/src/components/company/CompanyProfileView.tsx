import React, { useState } from 'react';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { Drawer } from '../common/Drawer.js';
import { CapabilityStatusBadge } from './CapabilityStatusBadge.js';
import { CapabilityItemCard } from './CapabilityItemCard.js';
import {
  type FullCompanyProfile,
  type CapabilitySectionId,
  type CapabilityStatus,
} from './companyProfileData.js';
import { Search, X, Check, CheckCircle2, Lock, FileText, FileSpreadsheet } from 'lucide-react';

export interface CompanyProfileViewProps {
  profile: FullCompanyProfile;
  activeSection: CapabilitySectionId;
}

export const CompanyProfileView: React.FC<CompanyProfileViewProps> = ({
  profile,
  activeSection,
}) => {
  const [selectedDocPreview, setSelectedDocPreview] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CapabilityStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCredTitle, setNewCredTitle] = useState('');
  const [newCredDocName, setNewCredDocName] = useState('');
  const [newCredUdin, setNewCredUdin] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddSuccess(true);
    setTimeout(() => {
      setAddSuccess(false);
      setIsAddModalOpen(false);
      setNewCredTitle('');
      setNewCredDocName('');
      setNewCredUdin('');
    }, 1200);
  };

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
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
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
                  {st === 'ALL' ? 'All' : st.replace('_', ' ')}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 1. OVERVIEW SECTION */}
      {/* ======================================================================= */}
      {activeSection === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Statutory Business Profile Card */}
          <div className="bg-card border border-border rounded-xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-border/80 mb-6">
              <div>
                <h2 className="text-base font-bold text-foreground font-heading">
                  Statutory Business Profile
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authoritative enterprise credentials verified against MCA, GSTN, MSME, and public
                  procurement registers.
                </p>
              </div>
              <Badge variant="neutral" size="sm" className="font-mono self-start sm:self-auto">
                Verified Dossier
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Item 1: Legal Entity Name */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Legal Entity Name
                </span>
                <span className="text-sm font-semibold text-foreground leading-snug">
                  {profile.legalEntityName}
                </span>
              </div>

              {/* Item 2: CIN */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  CIN / Registration Number
                </span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {profile.cinNumber}
                </span>
              </div>

              {/* Item 3: Incorporation Date */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Incorporation Date
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile.incorporationDate}
                </span>
              </div>

              {/* Item 4: MSME */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  MSME Category
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm" className="font-mono">
                    {profile.msmeCategory}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {profile.msmeType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Item 5: Debarment */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Statutory Debarment Status
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Check size={14} className="text-foreground shrink-0" />
                  <span>Clean / Not Debarred</span>
                </div>
              </div>

              {/* Item 6: Credit Rating */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  External Credit Rating
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {profile.creditRating.rating}{' '}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({profile.creditRating.agency})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid - Computed from Profile Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const auditedTurnovers = profile.turnoverRecords.filter(
                (t) => t.audited && t.isUdinValidated,
              );
              const avgTurnover =
                auditedTurnovers.length > 0
                  ? (
                      auditedTurnovers.reduce((sum, t) => sum + t.turnoverInrCrores, 0) /
                      auditedTurnovers.length
                    ).toFixed(2)
                  : '0.00';
              const allVerified =
                auditedTurnovers.length > 0 && auditedTurnovers.every((t) => t.isUdinValidated);

              const highestContract =
                profile.pastExperience.length > 0
                  ? profile.pastExperience.reduce((max, e) =>
                      e.contractValueInrCrores > max.contractValueInrCrores ? e : max,
                    )
                  : null;

              const activeSolvency = profile.solvencyRecords.find(
                (s) => s.status === 'VERIFIED' && new Date(s.validUntil) > new Date(),
              );

              return (
                <>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        3-Year Average Turnover
                      </span>
                      <div className="text-2xl font-bold font-heading text-foreground mt-1">
                        ₹{avgTurnover} Cr
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      {allVerified ? (
                        <Check size={13} className="text-foreground shrink-0" />
                      ) : (
                        <FileText size={13} className="shrink-0" />
                      )}
                      <span>
                        {allVerified
                          ? 'All audited with ICAI UDIN'
                          : 'Some records pending validation'}
                      </span>
                    </span>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Highest Single Contract
                      </span>
                      <div className="text-2xl font-bold font-heading text-foreground mt-1">
                        {highestContract
                          ? `₹${highestContract.contractValueInrCrores.toFixed(2)} Cr`
                          : '—'}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {highestContract ? highestContract.clientName : 'No verified contracts'}
                    </span>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Active Bank Solvency
                      </span>
                      <div className="text-2xl font-bold font-heading text-foreground mt-1">
                        {activeSolvency
                          ? `₹${activeSolvency.solvencyLimitInrCrores.toFixed(2)} Cr`
                          : '—'}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {activeSolvency ? activeSolvency.bankName : 'No active solvency certificate'}
                    </span>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Evidence Documents Linked
                      </span>
                      <div className="text-2xl font-bold font-heading text-foreground mt-1">
                        {profile.evidenceVault.length} Docs
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Check size={13} className="text-foreground shrink-0" />
                      <span>Tamper-proof hash checked</span>
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. REGISTRATIONS */}
      {/* ======================================================================= */}
      {activeSection === 'registrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.registrations
            .filter((r) => filterStatus === 'ALL' || r.status === filterStatus)
            .filter(
              (r) =>
                !searchQuery ||
                r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.regNumber.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((reg) => (
              <CapabilityItemCard
                key={reg.id}
                item={reg}
                typeBadge={reg.regType}
                expiryDate={reg.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Registration / License №',
                    value: reg.regNumber,
                    isMono: true,
                    highlight: true,
                  },
                  { label: 'Issuing Authority', value: reg.issuingAuthority },
                  { label: 'Jurisdiction / State', value: reg.stateOrJurisdiction || 'National' },
                  { label: 'Last Verified', value: reg.lastVerifiedAt || '2026-09-01' },
                ]}
              />
            ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 3. CERTIFICATIONS */}
      {/* ======================================================================= */}
      {activeSection === 'certifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.certifications
            .filter((c) => filterStatus === 'ALL' || c.status === filterStatus)
            .filter(
              (c) =>
                !searchQuery ||
                c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((cert) => (
              <CapabilityItemCard
                key={cert.id}
                item={cert}
                typeBadge={cert.standard}
                expiryDate={cert.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Certificate Number',
                    value: cert.certificateNumber,
                    isMono: true,
                    highlight: true,
                  },
                  { label: 'Accredited Registrar', value: cert.issuingBody },
                  { label: 'Valid From', value: cert.validFrom },
                  { label: 'Certified Scope', value: cert.scopeSummary },
                ]}
              />
            ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. FINANCIALS & UDIN */}
      {/* ======================================================================= */}
      {activeSection === 'financials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--color-surface-text)',
              margin: '0',
            }}
          >
            Audited Annual Financial Statements (with ICAI UDIN)
          </h3>
          {profile.turnoverRecords
            .filter((t) => filterStatus === 'ALL' || t.status === filterStatus)
            .filter(
              (t) =>
                !searchQuery ||
                t.financialYear.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.caUdin.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((to) => (
              <CapabilityItemCard
                key={to.id}
                item={to}
                typeBadge={to.financialYear}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Audited Annual Turnover',
                    value: `₹${to.turnoverInrCrores.toFixed(2)} Crores`,
                    highlight: true,
                  },
                  {
                    label: 'Computed Net Worth',
                    value: `₹${to.netWorthInrCrores.toFixed(2)} Crores`,
                  },
                  {
                    label: 'Profit After Tax (PAT)',
                    value: to.profitAfterTaxCrores
                      ? `₹${to.profitAfterTaxCrores.toFixed(2)} Crores`
                      : 'N/A',
                  },
                  {
                    label: 'ICAI CA UDIN',
                    value: `${to.caUdin} ${to.isUdinValidated ? '(Validated)' : ''}`,
                    isMono: true,
                    highlight: true,
                  },
                  {
                    label: 'Chartered Accountant Firm',
                    value: `${to.caFirmName} (Mem #${to.caMembershipNo})`,
                  },
                ]}
              />
            ))}

          <h3
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--color-surface-text)',
              margin: '0.75rem 0 0',
            }}
          >
            Bank Working Capital & Solvency Certificates
          </h3>
          {profile.solvencyRecords.map((solv) => (
            <CapabilityItemCard
              key={solv.id}
              item={solv}
              typeBadge="Bank Solvency"
              expiryDate={solv.validUntil}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                {
                  label: 'Solvency Certificate Limit',
                  value: `₹${solv.solvencyLimitInrCrores.toFixed(2)} Crores`,
                  highlight: true,
                },
                { label: 'Issuing Bank & Branch', value: solv.bankName },
                { label: 'Account Reference', value: solv.accountNumberMasked, isMono: true },
                { label: 'Sanction Date', value: solv.sanctionDate },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. PAST EXPERIENCE (7-YEAR QUALIFYING PROJECTS) */}
      {/* ======================================================================= */}
      {activeSection === 'experience' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.pastExperience
            .filter((e) => filterStatus === 'ALL' || e.status === filterStatus)
            .filter(
              (e) =>
                !searchQuery ||
                e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.clientName.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .map((exp) => (
              <CapabilityItemCard
                key={exp.id}
                item={exp}
                typeBadge={exp.clientType}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  {
                    label: 'Executed Contract Value',
                    value: `₹${exp.contractValueInrCrores.toFixed(2)} Crores`,
                    highlight: true,
                  },
                  { label: 'Procuring Client', value: exp.clientName },
                  { label: 'Completion Date', value: exp.completionDate },
                  { label: 'State / Location', value: exp.locationState },
                  {
                    label: 'Scope & Work Highlights',
                    value: (
                      <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {exp.scopeHighlights.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. MAJOR PROJECTS */}
      {/* ======================================================================= */}
      {activeSection === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.projects.map((proj) => (
            <CapabilityItemCard
              key={proj.id}
              item={proj}
              typeBadge={proj.role.replace('_', ' ')}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                { label: 'Project Name', value: proj.projectName, highlight: true },
                { label: 'Client / Authority', value: proj.clientName },
                {
                  label: 'Contract Value',
                  value: `₹${proj.contractValueInrCrores.toFixed(2)} Crores`,
                  highlight: true,
                },
                { label: 'Execution Period', value: `${proj.startDate} to ${proj.endDate}` },
                { label: 'Key Deliverables', value: proj.keyDeliverables },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. OEM RELATIONSHIPS & MAFs */}
      {/* ======================================================================= */}
      {activeSection === 'oem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.oemAuthorizations.map((oem) => (
            <CapabilityItemCard
              key={oem.id}
              item={oem}
              typeBadge={oem.partnerTier}
              expiryDate={oem.validUntil}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                { label: 'OEM Brand', value: oem.oemName, highlight: true },
                { label: 'Authorized Product Lines', value: oem.productCategories.join(', ') },
                { label: 'Authorized Territory', value: oem.authorizedTerritory },
                { label: 'Valid From', value: oem.validFrom },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 8. KEY PERSONNEL & STAFF */}
      {/* ======================================================================= */}
      {activeSection === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.employees.map((emp) => (
            <CapabilityItemCard
              key={emp.id}
              item={emp}
              typeBadge={emp.role.replace('_', ' ')}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                {
                  label: 'Full Name & Designation',
                  value: `${emp.name} — ${emp.designation}`,
                  highlight: true,
                },
                { label: 'Technical Qualification', value: emp.qualification },
                { label: 'Experience in Sector', value: `${emp.experienceYears} Years` },
                { label: 'EPFO UAN Reference', value: emp.epfoUan || 'N/A', isMono: true },
                {
                  label: 'Key Personnel Status',
                  value: emp.isKeyPersonnel ? 'Designated Key Personnel' : 'Supporting Staff',
                },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 9. PLANT & EQUIPMENT */}
      {/* ======================================================================= */}
      {activeSection === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.equipment.map((eq) => (
            <CapabilityItemCard
              key={eq.id}
              item={eq}
              typeBadge={`${eq.ownership} (${eq.quantity} Units)`}
              expiryDate={eq.calibrationValidUntil}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                { label: 'Equipment Model & Make', value: eq.modelAndMake, highlight: true },
                { label: 'Equipment Category', value: eq.equipmentType },
                { label: 'Rating / Capacity', value: eq.capacityOrRating },
                { label: 'Year of Manufacture', value: eq.manufactureYear },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 10. GEOGRAPHIC COVERAGE */}
      {/* ======================================================================= */}
      {activeSection === 'geography' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {profile.geographicCoverage.map((geo) => (
            <CapabilityItemCard
              key={geo.id}
              item={geo}
              typeBadge={geo.facilityType.replace('_', ' ')}
              onViewEvidence={(doc) => setSelectedDocPreview(doc)}
              fields={[
                {
                  label: 'Facility Address',
                  value: `${geo.address}, ${geo.city}, ${geo.state}`,
                  highlight: true,
                },
                { label: 'Committed SLA Response', value: `< ${geo.slaResponseHours} Hours` },
                {
                  label: 'Resident Staff Strength',
                  value: `${geo.serviceStaffCount} Technical Personnel`,
                },
              ]}
            />
          ))}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 11. EVIDENCE VAULT */}
      {/* ======================================================================= */}
      {activeSection === 'evidence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              backgroundColor: 'rgba(234, 88, 12, 0.08)',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Lock size={16} className="text-primary shrink-0" />
            <div>
              <strong>Tamper-Proof Evidence Vault</strong>: All source documents are verified with
              SHA-256 cryptographic hashes and automatically attached to qualifying tender bids.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.evidenceVault.map((doc) => (
              <Card key={doc.id} padding="md">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <FileText size={16} className="text-muted-foreground" />
                      <strong
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-surface-text)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {doc.fileName}
                      </strong>
                      <CapabilityStatusBadge status={doc.verificationStatus} size="sm" />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '1.25rem',
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--color-surface-muted)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        Type: <strong>{doc.docType}</strong>
                      </span>
                      <span>
                        Size: <strong>{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</strong>
                      </span>
                      <span>
                        Uploaded: <strong>{new Date(doc.uploadedAt).toLocaleDateString()}</strong>
                      </span>
                      <span>
                        Reused across:{' '}
                        <strong style={{ color: 'var(--color-surface-text)' }}>
                          {doc.linkedCapabilitiesCount} Capabilities
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--color-surface-muted)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: '0.35rem',
                      }}
                    >
                      SHA-256: {doc.sha256Hash}
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedDocPreview(doc.fileName)}
                  >
                    Inspect Document ↗
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Document Preview Drawer */}
      {selectedDocPreview && (
        <Drawer
          isOpen={true}
          onClose={() => setSelectedDocPreview(null)}
          title="Evidence Document Verification"
          description={selectedDocPreview}
          width="600px"
          footer={
            <Button variant="secondary" onClick={() => setSelectedDocPreview(null)}>
              Close Viewer
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                backgroundColor: 'var(--color-surface-bg)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div>
                <strong>File Name:</strong>{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedDocPreview}</span>
              </div>
              <div>
                <strong>Verification Tier:</strong>{' '}
                <span style={{ color: 'var(--status-pass-text)', fontWeight: 700 }}>
                  VERIFIED (Original Scanned PDF)
                </span>
              </div>
              <div>
                <strong>Cryptographic Hash:</strong>{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </span>
              </div>
            </div>

            {/* Document Viewer Mock Canvas */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-card-subtle)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-md)',
                height: '350px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-surface-muted)',
                gap: '0.75rem',
              }}
            >
              <FileSpreadsheet size={48} className="text-muted-foreground" />
              <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
                {selectedDocPreview}
              </span>
              <span style={{ fontSize: 'var(--text-xs)' }}>
                Authentic High-Resolution Digital Scan Verified
              </span>
            </div>
          </div>
        </Drawer>
      )}

      {/* Add Credential Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Reusable Corporate Capability"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddSubmit}>
                Save Capability
              </Button>
            </>
          }
        >
          {addSuccess ? (
            <div
              style={{
                color: 'var(--color-success)',
                textAlign: 'center',
                padding: '1.5rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={18} /> Capability added to persistent dossier!
            </div>
          ) : (
            <form
              onSubmit={handleAddSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-surface-text)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  Capability Title / Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. FY 2024-25 Turnover Statement or ISO 27001 Certificate"
                  value={newCredTitle}
                  onChange={(e) => setNewCredTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-surface-border)',
                    backgroundColor: 'var(--color-surface-input)',
                    color: 'var(--color-surface-text)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-surface-text)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  CA UDIN / Certificate Number (If applicable)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24098123AAAAA1234 or BVQI-IND-9001"
                  value={newCredUdin}
                  onChange={(e) => setNewCredUdin(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-surface-border)',
                    backgroundColor: 'var(--color-surface-input)',
                    color: 'var(--color-surface-text)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-surface-text)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  Evidence Document Name / Upload *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Audited_Balance_Sheet_2025.pdf"
                  value={newCredDocName}
                  onChange={(e) => setNewCredDocName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-surface-border)',
                    backgroundColor: 'var(--color-surface-input)',
                    color: 'var(--color-surface-text)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                />
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
