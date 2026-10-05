import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import type { ComplianceItem } from '../../api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.js';
import { Badge } from '../common/Badge.js';
import { LoadingSkeleton } from '../common/LoadingSkeleton.js';
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

export interface ActionRequiredCardProps {
  bids: BidSummary[];
  /** Clause-level compliance items keyed by bid ID (from useBidComplianceItems) */
  complianceByBid: Record<string, ComplianceItem[]>;
  /** True while per-bid compliance items are still being fetched */
  isLoadingCompliance?: boolean;
}

const MAX_VISIBLE_ITEMS = 5;

const CATEGORY_BADGE_VARIANT: Record<ComplianceItem['category'], 'info' | 'primary' | 'warning' | 'danger' | 'neutral'> = {
  FINANCIAL: 'info',
  TECHNICAL: 'primary',
  LEGAL: 'warning',
  STATUTORY: 'danger',
  EXECUTION: 'neutral',
  COMMERCIAL: 'neutral',
};

function ActionIcon({ item }: { item: ActionItem }) {
  switch (item.type as ActionItemType) {
    case 'FLAGGED_REQUIREMENT':
      return <AlertCircleIcon size={16} color="var(--color-danger)" />;
    case 'REVIEW_REQUIRED':
      return <ReviewRequiredIcon size={16} color="var(--color-warning)" />;
    case 'EXTRACTION_IN_PROGRESS':
      return <SpinnerIcon size={16} color="var(--color-info)" />;
    case 'IMMINENT_DEADLINE':
      return <WarningIcon size={16} color="var(--color-warning)" />;
    case 'DRAFT_INCOMPLETE':
    default:
      return <MissingIcon size={16} color="var(--color-info)" />;
  }
}

function urgencyBorder(urgency: ActionItem['urgency']): string {
  if (urgency === 'critical') return 'var(--color-danger-border)';
  if (urgency === 'high') return 'var(--color-warning-border)';
  return 'var(--color-surface-border)';
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

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          <Badge
            variant={actionItems.length > 0 ? 'warning' : 'success'}
            size="sm"
          >
            {actionItems.length} {actionItems.length === 1 ? 'Action' : 'Actions'}
          </Badge>
        }
      >
        <CardTitle as="h3">Action Required</CardTitle>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Flagged clauses, reviews, in-flight extraction, and imminent deadlines
        </p>
      </CardHeader>

      <CardContent>
        {isLoadingCompliance && actionItems.length === 0 ? (
          <LoadingSkeleton height="64px" count={3} borderRadius="var(--radius-md)" />
        ) : actionItems.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckIcon size={16} />
            </span>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                No Urgent Blockers
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
                All active tenders are on schedule with zero unreviewed critical flags.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {actionItems.slice(0, MAX_VISIBLE_ITEMS).map((item) => (
              <Link
                key={item.id}
                to={item.actionUrl}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface-card-subtle)',
                  border: `1px solid ${urgencyBorder(item.urgency)}`,
                  textDecoration: 'none',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-subtle)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', minWidth: 0 }}>
                  <span style={{ marginTop: '0.15rem', flexShrink: 0, display: 'inline-flex' }}>
                    <ActionIcon item={item} />
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                        {item.headline}
                      </span>
                      {item.category && (
                        <Badge variant={CATEGORY_BADGE_VARIANT[item.category]} size="sm">
                          {item.category}
                        </Badge>
                      )}
                      <span
                        style={{
                          fontSize: 'var(--text-2xs)',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--color-surface-muted)',
                        }}
                      >
                        № {item.tenderNumber}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-surface-muted)',
                        marginTop: '0.15rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                <span
                  style={{
                    color: 'var(--color-surface-subtle)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginLeft: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  <ChevronRightIcon size={14} />
                </span>
              </Link>
            ))}

            {actionItems.length > MAX_VISIBLE_ITEMS && (
              <div
                style={{
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--color-surface-subtle)',
                  textAlign: 'center',
                  paddingTop: '0.25rem',
                }}
              >
                +{actionItems.length - MAX_VISIBLE_ITEMS} more action
                {actionItems.length - MAX_VISIBLE_ITEMS === 1 ? '' : 's'} across your tenders
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
