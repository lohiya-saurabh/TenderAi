import React from 'react';
import type { BidSummary } from '@/api/bids.js';
import { formatCurrency, formatCompactINR } from '@/utils/formatCurrency.js';
import { TendersIcon, AlertCircleIcon, WarningIcon, CheckIcon } from '@/components/common/Icons.js';
import { useCompany } from '@/context/useCompany.js';

export interface DashboardKpiStripProps {
  bids: BidSummary[];
}

export const DashboardKpiStrip: React.FC<DashboardKpiStripProps> = ({ bids }) => {
  const { selectedCompany } = useCompany();
  const isGstVerified = Boolean(selectedCompany?.gstinVerifiedAt);
  const isMcaVerified = Boolean(selectedCompany?.mcaVerifiedAt);
  const isAnyVerified = isGstVerified || isMcaVerified;

  const activeBids = bids.filter((b) => b.status !== 'ARCHIVED');
  const reviewReadyCount = bids.filter((b) => b.status === 'REVIEW_READY').length;

  const totalValue = activeBids.reduce((sum, b) => sum + (Number(b.estimatedValueRupees) || 0), 0);

  const totalFlagged = bids.reduce((sum, b) => sum + (b.flaggedRequirements || 0), 0);

  const now = new Date().getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const urgentDeadlines = activeBids.filter((b) => {
    if (!b.submissionDeadline) return false;
    const deadlineTime = new Date(b.submissionDeadline).getTime();
    return deadlineTime > now && deadlineTime - now < sevenDaysMs;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Pipeline Count */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Active bids</span>
          <span className="text-muted-foreground">
            <TendersIcon size={15} />
          </span>
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {activeBids.length}
        </div>
        <div className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 mt-2">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              reviewReadyCount > 0 ? 'bg-primary' : 'bg-muted-foreground/40'
            }`}
          />
          <span
            className={`font-medium tabular-nums ${
              reviewReadyCount > 0 ? 'text-primary dark:text-primary' : 'text-muted-foreground'
            }`}
          >
            {reviewReadyCount} of {activeBids.length} ready for review
          </span>
        </div>
      </div>

      {/* 2. Total Contract Value */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Contract value</span>
          <span className="text-primary dark:text-primary">
            <CheckIcon size={15} />
          </span>
        </div>
        <div
          className="text-2xl font-semibold tabular-nums text-foreground"
          title={formatCurrency(totalValue)}
        >
          {formatCompactINR(totalValue)}
        </div>
        <div
          className="text-xs font-medium text-muted-foreground mt-2 truncate"
          title={`Total: ${formatCurrency(totalValue)}`}
        >
          Across {activeBids.length} active opportunities
        </div>
      </div>

      {/* 3. Statutory Evidence Status */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Evidence status</span>
          <span
            className={
              totalFlagged > 0
                ? 'text-destructive dark:text-destructive'
                : isAnyVerified
                  ? 'text-primary dark:text-primary'
                  : 'text-warning dark:text-warning'
            }
          >
            <AlertCircleIcon size={15} />
          </span>
        </div>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            totalFlagged > 0
              ? 'text-destructive dark:text-destructive'
              : isAnyVerified
                ? 'text-primary dark:text-primary'
                : 'text-warning dark:text-warning'
          }`}
        >
          {totalFlagged > 0 ? `${totalFlagged} flagged` : isAnyVerified ? 'Verified' : 'Pending'}
        </div>
        <div className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 mt-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              totalFlagged > 0 ? 'bg-destructive' : isAnyVerified ? 'bg-primary' : 'bg-warning'
            } inline-block`}
          />
          <span
            className={
              totalFlagged > 0
                ? 'text-destructive dark:text-destructive'
                : isAnyVerified
                  ? 'text-primary dark:text-primary font-medium'
                  : 'text-warning dark:text-warning font-medium'
            }
          >
            {totalFlagged > 0
              ? 'Requires proof or waiver'
              : isGstVerified && isMcaVerified
                ? 'IRIS GST & MCA RoC Active'
                : isGstVerified
                  ? 'IRIS GST Active'
                  : isMcaVerified
                    ? 'MCA RoC Active'
                    : 'Statutory verification pending'}
          </span>
        </div>
      </div>

      {/* 4. Submission Deadlines / Recommendation */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            {urgentDeadlines.length > 0 ? 'Closing soon' : 'Ready for review'}
          </span>
          <span
            className={
              urgentDeadlines.length > 0
                ? 'text-destructive dark:text-destructive'
                : reviewReadyCount > 0
                  ? 'text-primary dark:text-primary'
                  : 'text-muted-foreground'
            }
          >
            <WarningIcon size={15} />
          </span>
        </div>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            urgentDeadlines.length > 0
              ? 'text-destructive dark:text-destructive'
              : reviewReadyCount > 0
                ? 'text-primary dark:text-primary'
                : 'text-muted-foreground'
          }`}
        >
          {urgentDeadlines.length > 0
            ? `${urgentDeadlines.length} closing soon`
            : activeBids.length === 0
              ? 'No active bids'
              : reviewReadyCount > 0
                ? `${reviewReadyCount} ready`
                : 'None ready'}
        </div>
        <div className="text-xs font-medium text-foreground/80 mt-2">
          {urgentDeadlines.length > 0
            ? 'Due within 7 days'
            : activeBids.length === 0
              ? 'Create a bid to begin'
              : reviewReadyCount > 0
                ? 'Extraction finished; clauses to review'
                : 'Upload tender documents to start'}
        </div>
      </div>
    </div>
  );
};
