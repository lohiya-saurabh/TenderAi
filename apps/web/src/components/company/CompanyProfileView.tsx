import React, { useState } from 'react';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          backgroundColor: 'var(--color-surface-bg)',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px' }}>
          <Search size={14} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Search credentials, UDINs, standards, or work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-surface-text)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--color-surface-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 600 }}>
            Filter:
          </span>
          {(['ALL', 'VERIFIED', 'EXPIRING_SOON', 'EXPIRED', 'NEEDS_REVIEW'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${filterStatus === st ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
                backgroundColor: filterStatus === st ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-card)',
                color: filterStatus === st ? 'var(--color-primary-300)' : 'var(--color-surface-muted)',
                cursor: 'pointer',
              }}
            >
              {st === 'ALL' ? 'All' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 1. OVERVIEW SECTION */}
      {/* ======================================================================= */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0 0 0.85rem' }}>
              Statutory Business Profile
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--color-surface-bg)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>Legal Name</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                  {profile.legalEntityName}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>CIN Number</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>
                  {profile.cinNumber}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>Incorporation Date</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                  {profile.incorporationDate}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>MSME Category</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)' }}>
                  {profile.msmeCategory} Enterprise ({profile.msmeType.replace('_', ' ')})
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>Statutory Debarment Status</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={14} /> Clean / Not Debarred by any Govt Ministry
                </div>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>External Credit Rating</span>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-primary-300)' }}>
                  {profile.creditRating.rating} ({profile.creditRating.agency})
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats Grid - Computed from Profile Data */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {(() => {
              const auditedTurnovers = profile.turnoverRecords.filter(t => t.audited && t.isUdinValidated);
              const avgTurnover = auditedTurnovers.length > 0
                ? (auditedTurnovers.reduce((sum, t) => sum + t.turnoverInrCrores, 0) / auditedTurnovers.length).toFixed(2)
                : '0.00';
              const allVerified = auditedTurnovers.length > 0 && auditedTurnovers.every(t => t.isUdinValidated);

              const highestContract = profile.pastExperience.length > 0
                ? profile.pastExperience.reduce((max, e) => e.contractValueInrCrores > max.contractValueInrCrores ? e : max)
                : null;

              const activeSolvency = profile.solvencyRecords.find(s => s.status === 'VERIFIED' && new Date(s.validUntil) > new Date());

              return (
                <>
                  <Card padding="md">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>3-Year Average Turnover</span>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary-300)', marginTop: '0.25rem' }}>
                      ₹{avgTurnover} Crores
                    </div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: allVerified ? 'var(--color-success)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {allVerified ? <Check size={12} /> : <FileText size={12} />} {allVerified ? 'All audited with ICAI UDIN' : 'Some records pending validation'}
                    </span>
                  </Card>

                  <Card padding="md">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>Highest Single Contract Executed</span>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary-300)', marginTop: '0.25rem' }}>
                      {highestContract ? `₹${highestContract.contractValueInrCrores.toFixed(2)} Crores` : '—'}
                    </div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
                      {highestContract ? highestContract.clientName : 'No verified contracts'}
                    </span>
                  </Card>

                  <Card padding="md">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>Active Bank Solvency</span>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary-300)', marginTop: '0.25rem' }}>
                      {activeSolvency ? `₹${activeSolvency.solvencyLimitInrCrores.toFixed(2)} Crores` : '—'}
                    </div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
                      {activeSolvency ? activeSolvency.bankName : 'No active solvency certificate'}
                    </span>
                  </Card>

                  <Card padding="md">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>Evidence Documents Linked</span>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary-300)', marginTop: '0.25rem' }}>
                      {profile.evidenceVault.length} Documents
                    </div>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={12} /> Tamper-proof hash checked
                    </span>
                  </Card>
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
            .filter((r) => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.regNumber.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((reg) => (
              <CapabilityItemCard
                key={reg.id}
                item={reg}
                typeBadge={reg.regType}
                expiryDate={reg.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Registration / License №', value: reg.regNumber, isMono: true, highlight: true },
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
            .filter((c) => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((cert) => (
              <CapabilityItemCard
                key={cert.id}
                item={cert}
                typeBadge={cert.standard}
                expiryDate={cert.validUntil}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Certificate Number', value: cert.certificateNumber, isMono: true, highlight: true },
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
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0' }}>
            Audited Annual Financial Statements (with ICAI UDIN)
          </h3>
          {profile.turnoverRecords
            .filter((t) => filterStatus === 'ALL' || t.status === filterStatus)
            .filter((t) => !searchQuery || t.financialYear.toLowerCase().includes(searchQuery.toLowerCase()) || t.caUdin.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((to) => (
              <CapabilityItemCard
                key={to.id}
                item={to}
                typeBadge={to.financialYear}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Audited Annual Turnover', value: `₹${to.turnoverInrCrores.toFixed(2)} Crores`, highlight: true },
                  { label: 'Computed Net Worth', value: `₹${to.netWorthInrCrores.toFixed(2)} Crores` },
                  { label: 'Profit After Tax (PAT)', value: to.profitAfterTaxCrores ? `₹${to.profitAfterTaxCrores.toFixed(2)} Crores` : 'N/A' },
                  { label: 'ICAI CA UDIN', value: `${to.caUdin} ${to.isUdinValidated ? '(Validated)' : ''}`, isMono: true, highlight: true },
                  { label: 'Chartered Accountant Firm', value: `${to.caFirmName} (Mem #${to.caMembershipNo})` },
                ]}
              />
            ))}

          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0.75rem 0 0' }}>
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
                { label: 'Solvency Certificate Limit', value: `₹${solv.solvencyLimitInrCrores.toFixed(2)} Crores`, highlight: true },
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
            .filter((e) => !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((exp) => (
              <CapabilityItemCard
                key={exp.id}
                item={exp}
                typeBadge={exp.clientType}
                onViewEvidence={(doc) => setSelectedDocPreview(doc)}
                fields={[
                  { label: 'Executed Contract Value', value: `₹${exp.contractValueInrCrores.toFixed(2)} Crores`, highlight: true },
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
                { label: 'Contract Value', value: `₹${proj.contractValueInrCrores.toFixed(2)} Crores`, highlight: true },
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
                { label: 'Full Name & Designation', value: `${emp.name} — ${emp.designation}`, highlight: true },
                { label: 'Technical Qualification', value: emp.qualification },
                { label: 'Experience in Sector', value: `${emp.experienceYears} Years` },
                { label: 'EPFO UAN Reference', value: emp.epfoUan || 'N/A', isMono: true },
                { label: 'Key Personnel Status', value: emp.isKeyPersonnel ? 'Designated Key Personnel' : 'Supporting Staff' },
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
                { label: 'Facility Address', value: `${geo.address}, ${geo.city}, ${geo.state}`, highlight: true },
                { label: 'Committed SLA Response', value: `< ${geo.slaResponseHours} Hours` },
                { label: 'Resident Staff Strength', value: `${geo.serviceStaffCount} Technical Personnel` },
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
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
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
              <strong>Tamper-Proof Evidence Vault</strong>: All source documents are verified with SHA-256 cryptographic hashes and automatically attached to qualifying tender bids.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.evidenceVault.map((doc) => (
              <Card key={doc.id} padding="md">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <FileText size={16} className="text-muted-foreground" />
                      <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
                        {doc.fileName}
                      </strong>
                      <CapabilityStatusBadge status={doc.verificationStatus} size="sm" />
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', flexWrap: 'wrap' }}>
                      <span>Type: <strong>{doc.docType}</strong></span>
                      <span>Size: <strong>{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</strong></span>
                      <span>Uploaded: <strong>{new Date(doc.uploadedAt).toLocaleDateString()}</strong></span>
                      <span>Reused across: <strong style={{ color: 'var(--color-primary-300)' }}>{doc.linkedCapabilitiesCount} Capabilities</strong></span>
                    </div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
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
              <div><strong>File Name:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedDocPreview}</span></div>
              <div><strong>Verification Tier:</strong> <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>VERIFIED (Original Scanned PDF)</span></div>
              <div><strong>Cryptographic Hash:</strong> <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span></div>
            </div>

            {/* Document Viewer Mock Canvas */}
            <div
              style={{
                backgroundColor: '#1a1d2e',
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
            <div style={{ color: 'var(--color-success)', textAlign: 'center', padding: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} /> Capability added to persistent dossier!
            </div>
          ) : (
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', display: 'block', marginBottom: '0.35rem' }}>
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
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', display: 'block', marginBottom: '0.35rem' }}>
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
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', display: 'block', marginBottom: '0.35rem' }}>
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
