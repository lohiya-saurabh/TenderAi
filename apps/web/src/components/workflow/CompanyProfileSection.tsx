import React, { useState } from 'react';
import type { CompanyCapabilityProfile } from '../../types/workflow.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { Button } from '../common/Button.js';

export interface CompanyProfileSectionProps {
  profile: CompanyCapabilityProfile;
  onUpdateProfile?: (updated: CompanyCapabilityProfile) => void;
}

export const CompanyProfileSection: React.FC<CompanyProfileSectionProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'REGISTRATIONS' | 'FINANCIALS' | 'EXPERIENCE' | 'CERTIFICATIONS'>('REGISTRATIONS');

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🏢</span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
              {profile.companyName}
            </h3>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-success)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {profile.profileVersion}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)', margin: 0 }}>
            Persistent MSME Capability Repository — Evaluated automatically against every tender opportunity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" size="sm" icon={<span>📥</span>}>
            Export Profile
          </Button>
          <Button variant="primary" size="sm" icon={<span>✏️</span>}>
            Edit Credentials
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-surface-border)' }}>
        {(
          [
            { id: 'REGISTRATIONS', label: 'Statutory & Registrations', icon: '📜' },
            { id: 'FINANCIALS', label: 'Audited Turnover & UDIN', icon: '💰' },
            { id: 'EXPERIENCE', label: 'Past Experience & Work Orders', icon: '🏗️' },
            { id: 'CERTIFICATIONS', label: 'Certifications & OEM', icon: '🏅' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary-500)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary-100)' : 'var(--color-surface-muted)',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Registrations */}
      {activeTab === 'REGISTRATIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>GSTIN Number</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
              {profile.registrations.gstin}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
              ✓ Active Regular Taxpayer (Maharashtra)
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>Permanent Account Number (PAN)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
              {profile.registrations.pan}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginTop: '0.25rem' }}>
              Company / Corporate Entity
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>MSME UDYAM Registration</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-primary-500)', fontFamily: 'var(--font-mono)' }}>
              {profile.registrations.udyamNumber}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
              ✓ Category: {profile.registrations.msmeCategory} Enterprise (Eligible for EMD Waivers)
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>Authorized Signatory & DSC</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
              {profile.authorizedSignatories[0]?.name} ({profile.authorizedSignatories[0]?.designation})
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginTop: '0.25rem' }}>
              DSC Class 3 Token valid until {profile.authorizedSignatories[0]?.dscTokenValidUntil}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Financials & UDIN */}
      {activeTab === 'FINANCIALS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {profile.turnoverRecords.map((t) => (
              <div
                key={t.financialYear}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-surface-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-surface-muted)' }}>
                    {t.financialYear}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-success)',
                    }}
                  >
                    CA Audited
                  </span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-surface-text)', marginBottom: '0.5rem' }}>
                  {formatCurrency(t.turnoverRupees)}
                </div>
                {t.caUdin && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary-100)', fontFamily: 'var(--font-mono)' }}>
                    UDIN: {t.caUdin}
                  </div>
                )}
                {t.evidenceDocName && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)', marginTop: '0.25rem' }}>
                    📎 {t.evidenceDocName}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              color: 'var(--color-surface-text)',
            }}
          >
            <strong>💡 Why CA UDIN matters:</strong> Under Indian public procurement rules (IREPS, GeM, CPPP), any financial turnover or net worth certificate lacking a verified Unique Document Identification Number (UDIN) results in mandatory technical disqualification.
          </div>
        </div>
      )}

      {/* Tab Content 3: Past Experience */}
      {activeTab === 'EXPERIENCE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {profile.pastExperience.map((exp) => (
            <div
              key={exp.id}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-surface-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-surface-input)',
                      color: 'var(--color-primary-100)',
                      border: '1px solid var(--color-surface-border)',
                    }}
                  >
                    {exp.clientType}
                  </span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                    {exp.projectTitle}
                  </h4>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)', marginBottom: '0.5rem' }}>
                  Client: <strong>{exp.clientName}</strong> • Completed on {exp.completionDate}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-subtle)' }}>
                  {exp.scopeSummary}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-surface-text)', marginBottom: '0.35rem' }}>
                  {formatCurrency(exp.contractValueRupees)}
                </div>
                {exp.completionCertificateDocName && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    ✓ Cert Verified: {exp.completionCertificateDocName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 4: Certifications & OEM */}
      {activeTab === 'CERTIFICATIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {profile.certifications.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-surface-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                  {c.name}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-muted)' }}>
                Issuer: {c.issuingBody}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-subtle)', marginTop: '0.5rem' }}>
                Valid Until: <strong>{c.validUntil}</strong> • Cert #{c.certificateNumber}
              </div>
            </div>
          ))}

          {profile.oemAuthorizations.map((oem) => (
            <div
              key={oem.id}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-surface-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                  OEM: {oem.oemName}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-500)', fontWeight: 600 }}>Authorized Partner</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-muted)' }}>
                Category: {oem.productCategory}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-subtle)', marginTop: '0.5rem' }}>
                Partnership Valid Until: <strong>{oem.validUntil}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
