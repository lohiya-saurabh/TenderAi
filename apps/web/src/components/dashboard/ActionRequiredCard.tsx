import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import type { ComplianceItem } from '../../api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Skeleton } from '../ui/skeleton.js';
import {
  AlertCircleIcon,
  WarningIcon,
  ChevronRightIcon,
  CheckIcon,
  SpinnerIcon,
  ReviewRequiredIcon,
  MissingIcon,
} from '../common/Icons.js';
import {
  buildActionItems,
  type ActionItem,
  type ActionItemType,
} from './dashboardData.js';
import { cn } from '../../lib/utils.js';

export interface ActionRequiredCardProps {
  bids: BidSummary[];
  complianceByBid: Record<string, ComplianceItem[]>;
  isLoadingCompliance?: boolean;
}

const MAX_VISIBLE_ITEMS = 5;

const CATEGORY_BADGE_VARIANT: Record<ComplianceItem['category'], 'info' | 'default' | 'warning' | 'destructive' | 'secondary'> = {
  FINANCIAL: 'info',
  TECHNICAL: 'default',
  LEGAL: 'warning',
  STATUTORY: 'destructive',
  EXECUTION: 'secondary',
  COMMERCIAL: 'secondary',
};

function ActionIcon({ item }: { item: ActionItem }) {
  switch (item.type as ActionItemType) {
    case 'FLAGGED_REQUIREMENT':
      return <AlertCircleIcon size={16} className="text-destructive" />;
    case 'REVIEW_REQUIRED':
      return <ReviewRequiredIcon size={16} className="text-amber-400" />;
    case 'EXTRACTION_IN_PROGRESS':
      return <SpinnerIcon size={16} className="text-blue-400" />;
    case 'IMMINENT_DEADLINE':
      return <WarningIcon size={16} className="text-amber-400" />;
    case 'DRAFT_INCOMPLETE':
    default:
      return <MissingIcon size={16} className="text-blue-400" />;
  }
}

function urgencyBorderClass(urgency: ActionItem['urgency']): string {
  if (urgency === 'critical') return 'border-destructive/40 hover:border-destructive/60';
  if (urgency === 'high') return 'border-amber-500/40 hover:border-amber-500/60';
  return 'border-border hover:border-muted-foreground/30';
}

export const ActionRequiredCard: React.FC<ActionRequiredCardProps> = ({
  bids,
  complianceByBid,
  isLoadingCompliance = false,
}) => {
  const actionItems = useMemo(
    () => buildActionItems(bids, complianceByBid),
    [bids, complianceByBid],
  );

  const [isExpanded, setIsExpanded] = React.useState(false);
  const displayedItems = isExpanded ? actionItems : actionItems.slice(0, MAX_VISIBLE_ITEMS);

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Action Required</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Flagged clauses, reviews, in-flight extraction, and imminent deadlines
          </p>
        </div>
        <Badge
          variant={actionItems.length > 0 ? 'warning' : 'success'}
          className="font-medium"
        >
          {actionItems.length} {actionItems.length === 1 ? 'Action' : 'Actions'}
        </Badge>
      </CardHeader>

      <CardContent>
        {isLoadingCompliance && actionItems.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : actionItems.length === 0 ? (
          <div className="p-4 rounded-lg bg-card/60 border border-border flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckIcon size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                No Urgent Blockers
              </div>
              <div className="text-xs text-muted-foreground">
                All active tenders are on schedule with zero unreviewed critical flags.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                'flex flex-col gap-2 transition-all',
                isExpanded && 'max-h-[380px] overflow-y-auto pr-1'
              )}
            >
              {displayedItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.actionUrl}
                  className={cn(
                    'flex items-start justify-between p-3 rounded-lg bg-card/60 border transition-colors hover:bg-accent/50',
                    urgencyBorderClass(item.urgency)
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="mt-0.5 shrink-0 inline-flex">
                      <ActionIcon item={item} />
                    </span>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {item.headline}
                        </span>
                        {item.category && (
                          <Badge variant={CATEGORY_BADGE_VARIANT[item.category]} className="text-[10px] px-1.5 py-0">
                            {item.category}
                          </Badge>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          № {item.tenderNumber}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-muted-foreground/60 inline-flex items-center ml-2 shrink-0">
                    <ChevronRightIcon size={14} />
                  </span>
                </Link>
              ))}
            </div>

            {actionItems.length > MAX_VISIBLE_ITEMS && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="w-full pt-1.5 pb-0.5 text-[11px] text-muted-foreground hover:text-foreground text-center transition-colors font-medium cursor-pointer focus:outline-hidden"
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <span>Show top {MAX_VISIBLE_ITEMS} actions ↑</span>
                ) : (
                  <span>
                    +{actionItems.length - MAX_VISIBLE_ITEMS} more action
                    {actionItems.length - MAX_VISIBLE_ITEMS === 1 ? '' : 's'} across your tenders ↓
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
