import React from 'react';
import { Button } from '@/components/common/Button.js';
import { Badge } from '@/components/common/Badge.js';
import { type FullCompanyProfile, computeProfileHealth } from '@/components/company/companyProfileData.js';
import { Zap, Building2, Check, FolderArchive, Plus } from 'lucide-react';
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

  const displayName = selectedCompany?.legalName || profile.companyName;
  const displayGstin =
    selectedCompany?.gstin ||
    profile.registrations.find((r) => r.regType === 'GSTIN')?.regNumber ||
    'Pending Registration';


  return (
    <div className="flex flex-col gap-4">
      {/* 1. Value Proposition Banner */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Maintain your company information once and reuse it across tenders.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All verified registrations, CA UDIN financials, and past experience are automatically
              matched for every new tender.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.profileVersion && (
            <Badge variant="neutral" size="sm">
              {profile.profileVersion}
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Main Identity & Health Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex justify-between items-start flex-wrap gap-4">
          {/* Company Details */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <Building2 className="w-6 h-6 text-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight text-foreground m-0">
                {displayName}
              </h1>
              {profile.msmeCategory && (
                <Badge variant="neutral" size="sm">
                  MSME {profile.msmeCategory.toLowerCase()}
                </Badge>
              )}
              {profile.isBlacklisted === false && (
                <Badge variant="neutral" size="sm">
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-foreground" /> Not debarred
                  </span>
                </Badge>
              )}
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap mt-2">
              <div>
                <span>GSTIN</span>{' '}
                <span className="font-mono font-medium text-foreground">{displayGstin}</span>
              </div>
              <div>
                <span>CIN</span>{' '}
                <span className="font-mono font-medium text-foreground">{profile.cinNumber}</span>
              </div>
              <div>
                <span>Incorporated</span>{' '}
                <span className="text-foreground">{profile.incorporationDate}</span>
              </div>
              <div>
                <span>Credit rating</span>{' '}
                <span className="text-foreground">
                  {profile.creditRating?.rating ?? 'Not stated'}
                </span>
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
              Upload evidence
            </Button>
          </div>
        </div>

        {/* Real-time Health Metrics Strip */}
        <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
          {/* Health Score Gauge */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground">Tender readiness health</span>
              <strong className="tabular-nums text-foreground font-bold">
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
            <div className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs">
              <span className="text-foreground font-semibold tabular-nums">{health.verifiedCount}</span>{' '}
              <span className="text-muted-foreground">verified credentials</span>
            </div>

            {health.expiringSoonCount > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-1.5 text-xs tabular-nums">
                <span className="text-warning dark:text-warning font-bold">
                  {health.expiringSoonCount}
                </span>{' '}
                <span className="text-muted-foreground">Expiring soon</span>
              </div>
            )}

            {health.expiredCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5 text-xs tabular-nums">
                <span className="text-destructive font-bold">{health.expiredCount}</span>{' '}
                <span className="text-muted-foreground">Expired</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
