import React, { useState } from 'react';
import { Button } from '@/components/common/Button.js';
import { Badge } from '@/components/common/Badge.js';
import { Modal } from '@/components/common/Modal.js';
import { type FullCompanyProfile, computeProfileHealth } from '@/components/company/companyProfileData.js';
import { Zap, Building2, Check, CheckCircle2, FolderArchive, Plus, RefreshCw } from 'lucide-react';
import { useCompany } from '@/context/useCompany.js';

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
  const displayGstin =
    selectedCompany?.gstin ||
    profile.registrations.find((r) => r.regType === 'GSTIN')?.regNumber ||
    '27AAKCA1234F1Z5';

  const handlePublishVersion = () => {
    setPublishSuccess(true);
    setTimeout(() => {
      setPublishSuccess(false);
      setIsPublishModalOpen(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Value Proposition Banner */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Maintain your company information once and reuse it across tenders.
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All verified registrations, CA UDIN financials, and past experience are automatically
              matched for every new tender.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="neutral"
            size="sm"
            className="font-mono bg-muted/50 border-border text-foreground"
          >
            {profile.profileVersion}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPublishModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Publish Version
          </Button>
        </div>
      </div>

      {/* 2. Main Identity & Health Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex justify-between items-start flex-wrap gap-4">
          {/* Company Details */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <Building2 className="w-6 h-6 text-foreground" />
              <h1 className="text-xl font-bold tracking-tight text-foreground m-0">
                {displayName}
              </h1>
              <Badge variant="neutral" size="sm" dot>
                Active Dossier
              </Badge>
              <Badge variant="neutral" size="sm" className="font-mono">
                MSME {profile.msmeCategory}
              </Badge>
              {!profile.isBlacklisted && (
                <Badge variant="neutral" size="sm">
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-foreground" /> Clean Non-Debarment Record
                  </span>
                </Badge>
              )}
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap font-mono mt-2">
              <div>
                <strong className="text-foreground">GSTIN:</strong>{' '}
                <span className="text-foreground font-semibold">{displayGstin}</span>
              </div>
              <div>
                <strong className="text-foreground">CIN:</strong>{' '}
                <span className="text-foreground font-semibold">{profile.cinNumber}</span>
              </div>
              <div>
                <strong className="text-foreground">Incorporated:</strong>{' '}
                <span>{profile.incorporationDate}</span>
              </div>
              <div>
                <strong className="text-foreground">Credit Rating:</strong>{' '}
                <span className="text-foreground font-semibold">{profile.creditRating.rating}</span>
              </div>
            </div>
          </div>

          {/* Action Station */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={onOpenVault} className="gap-1.5 text-xs">
              <FolderArchive className="w-3.5 h-3.5" />
              Evidence Vault ({profile.evidenceVault.length})
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onAddCredential}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Capability
            </Button>
          </div>
        </div>

        {/* Real-time Health Metrics Strip */}
        <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
          {/* Health Score Gauge */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground">Tender Readiness Health</span>
              <strong className="font-mono text-foreground font-bold">
                {health.healthScorePct}%
              </strong>
            </div>
            <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-500 bg-foreground"
                style={{ width: `${health.healthScorePct}%` }}
              />
            </div>
          </div>

          {/* Count Cards */}
          <div className="flex gap-2 flex-wrap sm:col-span-1 md:col-span-2 justify-start md:justify-end">
            <div className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono">
              <span className="text-foreground font-bold">{health.verifiedCount}</span>{' '}
              <span className="text-muted-foreground">Verified Credentials</span>
            </div>

            {health.expiringSoonCount > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-xs font-mono">
                <span className="text-orange-600 dark:text-orange-400 font-bold">
                  {health.expiringSoonCount}
                </span>{' '}
                <span className="text-muted-foreground">Expiring Soon</span>
              </div>
            )}

            {health.expiredCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5 text-xs font-mono">
                <span className="text-destructive font-bold">{health.expiredCount}</span>{' '}
                <span className="text-muted-foreground">Expired</span>
              </div>
            )}
          </div>
        </div>
      </div>

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
          <div className="flex flex-col gap-3 text-sm">
            {publishSuccess ? (
              <div className="text-primary text-center py-4 flex items-center justify-center gap-2 font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Profile Version v2.5 published and pinned
                successfully!
              </div>
            ) : (
              <>
                <p className="m-0 text-foreground">
                  Publishing creates a permanent cryptographic snapshot of all verified credentials,
                  CA UDIN statements, and registrations.
                </p>
                <div className="bg-background p-3 rounded-lg border border-border text-xs text-muted-foreground font-mono space-y-1">
                  <div>• Active bids will retain their pinned versions.</div>
                  <div>• New bid evaluations will automatically utilize this new snapshot.</div>
                  <div>
                    • All linked evidence documents will be locked in the tamper-proof ledger.
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
