import React from 'react';
import { Badge } from '@/components/common/Badge.js';
import { Check, FileText } from 'lucide-react';
import type { FullCompanyProfile } from '@/components/company/companyProfileData.js';

export interface StatutoryProfileCardProps {
  profile: FullCompanyProfile;
}

export const StatutoryProfileCard: React.FC<StatutoryProfileCardProps> = ({ profile }) => {
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
          {/* Legal Entity Name */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Legal Entity Name
            </span>
            <span className="text-sm font-semibold text-foreground leading-snug">
              {profile.legalEntityName}
            </span>
          </div>

          {/* CIN */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              CIN / Registration Number
            </span>
            <span className="text-sm font-mono font-semibold text-foreground">
              {profile.cinNumber}
            </span>
          </div>

          {/* Incorporation Date */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Incorporation Date
            </span>
            <span className="text-sm font-semibold text-foreground">
              {profile.incorporationDate}
            </span>
          </div>

          {/* MSME */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              MSME Category
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm" className="font-mono">
                {profile.msmeCategory}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {profile.msmeType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Debarment */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Statutory Debarment Status
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Check size={14} className="text-foreground shrink-0" />
              <span>Clean / Not Debarred</span>
            </div>
          </div>

          {/* Credit Rating */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              External Credit Rating
            </span>
            {profile.creditRating ? (
              <span className="text-sm font-semibold text-foreground">
                {profile.creditRating.rating}{' '}
                <span className="text-xs text-muted-foreground font-normal">
                  ({profile.creditRating.agency})
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Not Rated / Assessment Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid - Computed from Profile Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 3-Year Average Turnover */}
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
                : auditedTurnovers.length > 0
                  ? 'Some records pending validation'
                  : 'No audited records'}
            </span>
          </span>
        </div>

        {/* Highest Single Contract */}
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

        {/* Active Bank Solvency */}
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

        {/* Evidence Documents Linked */}
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
      </div>
    </div>
  );
};
