import React from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.js';
import { Badge } from '../common/Badge.js';
import { WarningIcon, ChevronRightIcon } from '../common/Icons.js';
import { formatDate } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

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
    <Card variant="default" padding="md">
      <CardHeader
        action={
          <Badge variant="neutral" size="sm">
            {datedBids.length} Scheduled
          </Badge>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <WarningIcon size={16} color="var(--color-warning)" />
          <CardTitle as="h3">Upcoming Tender Deadlines</CardTitle>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Submission closing dates ordered chronologically for bidding operations
        </p>
      </CardHeader>

      <CardContent>
        {datedBids.length === 0 ? (
          <div
            style={{
              padding: '1.25rem',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-border)',
              color: 'var(--color-surface-muted)',
              fontSize: 'var(--text-xs)',
            }}
          >
            No active tenders with pending submission deadlines.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {datedBids.slice(0, 4).map((bid) => {
              const isUrgent = bid.daysLeft <= 3 && bid.daysLeft > 0;
              const isImminent = bid.daysLeft <= 7 && bid.daysLeft > 3;
              const isPassed = bid.diffMs <= 0;

              return (
                <Link
                  key={bid.id}
                  to={`/bids/${bid.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-surface-card-subtle)',
                    border: isUrgent
                      ? '1px solid var(--color-danger-border)'
                      : '1px solid var(--color-surface-border)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-subtle)')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--color-surface-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '260px',
                      }}
                    >
                      {bid.title}
                    </span>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', display: 'flex', gap: '0.4rem' }}>
                      <span>{bid.tenderingAuthority}</span>
                      <span>•</span>
                      <span>{bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : 'Value TBD'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 'var(--text-2xs)',
                          fontWeight: 700,
                          color: isPassed
                            ? 'var(--color-surface-subtle)'
                            : isUrgent
                              ? 'var(--color-danger)'
                              : isImminent
                                ? 'var(--color-warning)'
                                : 'var(--color-surface-text)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isPassed
                          ? 'Window Closed'
                          : bid.daysLeft === 1
                            ? '1 day left'
                            : `${bid.daysLeft} days left`}
                      </div>
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)' }}>
                        {formatDate(bid.submissionDeadline!)}
                      </div>
                    </div>

                    <ChevronRightIcon size={14} color="var(--color-surface-subtle)" />
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
