import React from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '@/api/bids.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { WarningIcon, ChevronRightIcon } from '@/components/common/Icons.js';
import { formatDate } from '@/utils/formatDate.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { cn } from '@/lib/utils.js';

export interface UpcomingDeadlinesCardProps {
  bids: BidSummary[];
}

export const UpcomingDeadlinesCard: React.FC<UpcomingDeadlinesCardProps> = ({ bids }) => {
  const now = new Date().getTime();

  // Filter bids with valid deadlines, excluding archived or already submitted
  const datedBids = bids
    .filter((b) => b.submissionDeadline && b.status !== 'ARCHIVED' && b.status !== 'SUBMITTED')
    .map((b) => {
      const deadlineMs = new Date(b.submissionDeadline!).getTime();
      const diffMs = deadlineMs - now;
      const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      return { ...b, deadlineMs, diffMs, daysLeft };
    })
    .sort((a, b) => a.deadlineMs - b.deadlineMs);

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <WarningIcon size={16} className="text-amber-400" />
            <CardTitle className="text-base font-semibold">Upcoming Tender Deadlines</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submission closing dates ordered chronologically for bidding operations
          </p>
        </div>
        <Badge variant="secondary" className="font-medium">
          {datedBids.length} Scheduled
        </Badge>
      </CardHeader>

      <CardContent>
        {datedBids.length === 0 ? (
          <div className="p-4 text-center rounded-lg bg-card/60 border border-border text-muted-foreground text-xs">
            No active tenders with pending submission deadlines.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {datedBids.slice(0, 4).map((bid) => {
              const isUrgent = bid.daysLeft <= 3 && bid.daysLeft > 0;
              const isImminent = bid.daysLeft <= 7 && bid.daysLeft > 3;
              const isPassed = bid.diffMs <= 0;

              return (
                <Link
                  key={bid.id}
                  to={`/bids/${bid.id}`}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg bg-card/60 border transition-colors hover:bg-accent/50',
                    isUrgent
                      ? 'border-destructive/40 hover:border-destructive/60'
                      : 'border-border',
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[260px]">
                      {bid.title}
                    </span>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <span>{bid.tenderingAuthority}</span>
                      <span>•</span>
                      <span className="font-mono font-medium text-foreground">
                        {bid.estimatedValueRupees
                          ? formatCurrency(bid.estimatedValueRupees)
                          : 'Value TBD'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider',
                          isPassed
                            ? 'text-muted-foreground'
                            : isUrgent
                              ? 'text-destructive'
                              : isImminent
                                ? 'text-amber-400'
                                : 'text-foreground',
                        )}
                      >
                        {isPassed
                          ? 'Window Closed'
                          : bid.daysLeft === 1
                            ? '1 day left'
                            : `${bid.daysLeft} days left`}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {formatDate(bid.submissionDeadline!)}
                      </div>
                    </div>

                    <ChevronRightIcon size={14} className="text-muted-foreground/60" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
