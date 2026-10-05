import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import { Modal } from '../common/Modal.js';
import {
  type FullCompanyProfile,
  computeProfileHealth,
} from './companyProfileData.js';
import { Zap, Building2, Check, CheckCircle2, FolderArchive, Plus, RefreshCw } from 'lucide-react';

import { useCompany } from '../../context/CompanyContext.js';
import { CompanySelector } from '../layout/CompanySelector.js';

export interface CompanyProfileHeaderProps {
  profile: FullCompanyProfile;
  onOpenVault: () => void;
  onAddCredential: () => void;
}

export const CompanyProfileHeader: React.FC<CompanyProfileHeaderProps> = ({
  profile,
  onOpenVault,
  onAddCredential,
}) => {
  const { selectedCompany } = useCompany();
  const health = computeProfileHealth(profile);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  const displayName = selectedCompany?.legalName || profile.companyName;
  const displayGstin = selectedCompany?.gstin || profile.registrations.find((r) => r.regType === 'GSTIN')?.regNumber || '27AAKCA1234F1Z5';

  const handlePublishVersion = () => {
    setPublishSuccess(true);
    setTimeout(() => {
      setPublishSuccess(false);
      setIsPublishModalOpen(false);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Reusable Value Proposition Banner */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Zap size={20} className="text-primary" />
          <div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)' }}>
              Maintain your company information once and reuse it across tenders.
            </span>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', margin: '0.1rem 0 0' }}>
              All verified registrations, CA UDIN financials, and work experience are automatically evaluated for every new tender.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CompanySelector />
          <Badge variant="primary" size="sm">
            {profile.profileVersion}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setIsPublishModalOpen(true)} icon={<RefreshCw size={14} />}>
            Publish Version
          </Button>
        </div>
      </div>

      {/* Main Identity & Health Card */}
      <Card padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          {/* Company Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <Building2 size={24} className="text-primary" />
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-surface-text)', margin: 0 }}>
                {displayName}
              </h1>
              <Badge variant="success" size="sm" dot>
                Active Dossier
              </Badge>
              <Badge variant="neutral" size="sm">
                MSME {profile.msmeCategory}
              </Badge>
              {!profile.isBlacklisted && (
                <Badge variant="success" size="sm">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Check size={12} /> Clean Non-Debarment Record
                  </span>
                </Badge>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <div>
                <strong>GSTIN:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>{displayGstin}</span>
              </div>
              <div>
                <strong>CIN:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>{profile.cinNumber}</span>
              </div>
              <div>
                <strong>Incorporated:</strong> <span style={{ color: 'var(--color-surface-text)' }}>{profile.incorporationDate}</span>
              </div>
              <div>
                <strong>Credit Rating:</strong> <span style={{ color: 'var(--color-primary-300)', fontWeight: 600 }}>{profile.creditRating.rating}</span>
              </div>
            </div>
          </div>

          {/* Action Station */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={onOpenVault} icon={<FolderArchive size={14} />}>
              Evidence Vault ({profile.evidenceVault.length})
            </Button>
            <Button variant="primary" size="sm" onClick={onAddCredential} icon={<Plus size={14} />}>
              Add Capability
            </Button>
          </div>
        </div>

        {/* Real-time Health Metrics Strip */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1.1rem',
            borderTop: '1px solid var(--color-surface-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          {/* Health Score Gauge */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>Tender Readiness Health</span>
              <strong style={{ color: health.isBidReady ? 'var(--color-success)' : 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                {health.healthScorePct}%
              </strong>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--color-surface-bg)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${health.healthScorePct}%`,
                  backgroundColor: health.isBidReady ? 'var(--color-success)' : 'var(--color-warning)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Count Cards */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '0.4rem 0.75rem',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{health.verifiedCount}</span>{' '}
              <span style={{ color: 'var(--color-surface-muted)' }}>Verified</span>
            </div>

            {health.expiringSoonCount > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.4rem 0.75rem',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{health.expiringSoonCount}</span>{' '}
                <span style={{ color: 'var(--color-surface-muted)' }}>Expiring Soon</span>
              </div>
            )}

            {health.expiredCount > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.4rem 0.75rem',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{health.expiredCount}</span>{' '}
                <span style={{ color: 'var(--color-surface-muted)' }}>Expired</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Publish Version Modal */}
      {isPublishModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPublishModalOpen(false)}
          title="Publish New Immutable Profile Snapshot"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePublishVersion}>
                Publish v2.5
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: 'var(--text-sm)' }}>
            {publishSuccess ? (
              <div style={{ color: 'var(--color-success)', textAlign: 'center', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> Profile Version v2.5 published and pinned successfully!
              </div>
            ) : (
              <>
                <p style={{ margin: 0, color: 'var(--color-surface-text)' }}>
                  Publishing creates a permanent cryptographic snapshot of all verified credentials, CA UDIN statements, and registrations.
                </p>
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-bg)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-surface-border)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-surface-muted)',
                  }}
                >
                  • Active bids will retain their pinned versions.<br />
                  • New bid evaluations will automatically utilize this new snapshot.<br />
                  • All linked evidence documents will be locked in the tamper-proof ledger.
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
