import React from 'react';
import type { BidSummary } from '../../api/bids.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { Card } from '../ui/card.js';
import {
  TendersIcon,
  AlertCircleIcon,
  WarningIcon,
  CheckIcon,
} from '../common/Icons.js';

export interface DashboardKpiStripProps {
  bids: BidSummary[];
}

export const DashboardKpiStrip: React.FC<DashboardKpiStripProps> = ({ bids }) => {
  const activeBids = bids.filter((b) => b.status !== 'ARCHIVED');

  const totalValue = activeBids.reduce(
    (sum, b) => sum + (Number(b.estimatedValueRupees) || 0),
    0
  );

  const totalFlagged = bids.reduce(
    (sum, b) => sum + (b.flaggedRequirements || 0),
    0
  );

  const now = new Date().getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const urgentDeadlines = activeBids.filter((b) => {
    if (!b.submissionDeadline) return false;
    const deadlineTime = new Date(b.submissionDeadline).getTime();
    return deadlineTime > now && deadlineTime - now < sevenDaysMs;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Active Pipeline Count */}
      <Card className="border-t-2 border-t-primary p-4 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Pipeline
          </span>
          <span className="text-primary">
            <TendersIcon size={15} />
          </span>
        </div>
        <div className="text-2xl font-bold text-foreground leading-tight tabular-nums">
          {activeBids.length}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          <strong className="text-foreground font-semibold">
            {bids.filter((b) => b.status === 'REVIEW_READY').length}
          </strong>{' '}
          ready for review
        </div>
      </Card>

      {/* 2. Total Contract Value */}
      <Card className="border-t-2 border-t-emerald-500 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pipeline Value (INR)
          </span>
          <span className="text-emerald-400">
            <CheckIcon size={15} />
          </span>
        </div>
        <div className="text-2xl font-bold text-foreground leading-tight tabular-nums">
          {formatCurrency(totalValue)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Across {activeBids.length} active opportunities
        </div>
      </Card>

      {/* 3. Action Required Items */}
      <Card
        className={`p-4 shadow-xs ${
          totalFlagged > 0 ? 'border-t-2 border-t-destructive' : 'border-t-2 border-t-border'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Compliance Flags
          </span>
          <span className={totalFlagged > 0 ? 'text-destructive' : 'text-muted-foreground'}>
            <AlertCircleIcon size={15} />
          </span>
        </div>
        <div
          className={`text-2xl font-bold leading-tight tabular-nums ${
            totalFlagged > 0 ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {totalFlagged}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {totalFlagged > 0 ? 'Clauses requiring proof or waiver' : 'Zero disqualifying flags'}
        </div>
      </Card>

      {/* 4. Urgent Deadlines (< 7 days) */}
      <Card
        className={`p-4 shadow-xs ${
          urgentDeadlines.length > 0 ? 'border-t-2 border-t-amber-500' : 'border-t-2 border-t-border'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Imminent Deadlines
          </span>
          <span className={urgentDeadlines.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
            <WarningIcon size={15} />
          </span>
        </div>
        <div
          className={`text-2xl font-bold leading-tight tabular-nums ${
            urgentDeadlines.length > 0 ? 'text-amber-400' : 'text-foreground'
          }`}
        >
          {urgentDeadlines.length}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Submissions closing within 7 days
        </div>
      </Card>
    </div>
  );
};
