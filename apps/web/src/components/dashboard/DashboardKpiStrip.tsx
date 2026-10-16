import React from 'react';
import type { BidSummary } from '@/api/bids.js';
import { formatCurrency, formatCompactINR } from '@/utils/formatCurrency.js';
import { TendersIcon, AlertCircleIcon, WarningIcon, CheckIcon } from '@/components/common/Icons.js';

export interface DashboardKpiStripProps {
  bids: BidSummary[];
}

export const DashboardKpiStrip: React.FC<DashboardKpiStripProps> = ({ bids }) => {
  const activeBids = bids.filter((b) => b.status !== 'ARCHIVED');

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
          <span className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            ACTIVE BIDS TRACKED
          </span>
          <span className="text-muted-foreground">
            <TendersIcon size={15} />
          </span>
        </div>
        <div className="text-3xl font-bold tracking-tight text-foreground">
          {String(activeBids.length).padStart(2, '0')}
        </div>
        <div className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold mono">
            {bids.filter((b) => b.status === 'REVIEW_READY').length} of {activeBids.length || 1}{' '}
            evaluated
          </span>
        </div>
      </div>

      {/* 2. Total Contract Value */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            PIPELINE CONTRACT VALUE
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            <CheckIcon size={15} />
          </span>
        </div>
        <div
          className="text-3xl font-bold tracking-tight text-foreground"
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
          <span className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            EVIDENCE STATUS
          </span>
          <span
            className={
              totalFlagged > 0 ? 'text-vermilion' : 'text-emerald-600 dark:text-emerald-400'
            }
          >
            <AlertCircleIcon size={15} />
          </span>
        </div>
        <div
          className={`text-3xl font-bold tracking-tight ${totalFlagged > 0 ? 'text-vermilion' : 'text-emerald-600 dark:text-emerald-400'}`}
        >
          {totalFlagged > 0 ? `${totalFlagged} Flags` : 'Verified'}
        </div>
        <div className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 mt-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${totalFlagged > 0 ? 'bg-vermilion' : 'bg-emerald-500'} inline-block`}
          />
          <span
            className={
              totalFlagged > 0
                ? 'text-vermilion'
                : 'text-emerald-700 dark:text-emerald-400 font-medium'
            }
          >
            {totalFlagged > 0 ? 'Requires proof or waiver' : 'IRIS GST & MCA RoC Active'}
          </span>
        </div>
      </div>

      {/* 4. Submission Deadlines / Recommendation */}
      <div className="p-5 border border-border rounded-lg bg-card shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {urgentDeadlines.length > 0 ? 'IMMINENT DEADLINES' : 'PIPELINE HEALTH'}
          </span>
          <span
            className={
              urgentDeadlines.length > 0
                ? 'text-vermilion'
                : 'text-emerald-600 dark:text-emerald-400'
            }
          >
            <WarningIcon size={15} />
          </span>
        </div>
        <div
          className={`text-2xl font-bold tracking-tight ${urgentDeadlines.length > 0 ? 'text-vermilion' : 'text-emerald-600 dark:text-emerald-400'}`}
        >
          {urgentDeadlines.length > 0 ? `${urgentDeadlines.length} Closing Soon` : 'PURSUE READY'}
        </div>
        <div className="text-xs font-medium text-foreground/80 mt-2">
          {urgentDeadlines.length > 0 ? 'Submissions due < 7 days' : 'Readiness evaluated'}
        </div>
      </div>
    </div>
  );
};
