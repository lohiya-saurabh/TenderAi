import React from 'react';
import type { BidDetail } from '../../../api/bids.js';
import { StatusBadge } from '../../common/StatusBadge.js';
import { Card } from '../../common/Card.js';
import { formatCurrency } from '../../../utils/formatCurrency.js';
import { formatDate } from '../../../utils/formatDate.js';
import { getDeadlineInfo } from '../../../utils/deadline.js';

export interface TenderInfoHeaderProps {
  bid: BidDetail;
}

/**
 * Tender information — real fields from GET /api/v1/bids/:id only.
 * No derived EMD, no assumed closing times, no fallback values:
 * anything the backend does not provide renders as "Not specified".
 */
export const TenderInfoHeader: React.FC<TenderInfoHeaderProps> = ({ bid }) => {
  const nowMs = Date.now();
  const deadline = bid.submissionDeadline
    ? getDeadlineInfo(bid.submissionDeadline, nowMs)
    : null;

  const deadlineLabel =
    deadline === null
      ? 'Not specified'
      : deadline.urgency === 'passed'
        ? `${formatDate(bid.submissionDeadline!)} (closed)`
        : `${formatDate(bid.submissionDeadline!)} — ${deadline.daysLeft} day${deadline.daysLeft === 1 ? '' : 's'} left`;

  const deadlineColor =
    deadline === null
      ? 'var(--color-surface-subtle)'
      : deadline.urgency === 'urgent'
        ? 'var(--color-danger)'
        : deadline.urgency === 'soon'
          ? 'var(--color-warning)'
          : deadline.urgency === 'passed'
            ? 'var(--color-surface-subtle)'
            : 'var(--color-surface-muted)';

  return (
    <Card variant="default" padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Title & status */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)' as unknown as number,
              color: 'var(--color-surface-text)',
              margin: 0,
              lineHeight: 'var(--leading-tight)',
              flex: 1,
              minWidth: '280px',
            }}
          >
            {bid.title}
          </h2>
          <StatusBadge status={bid.status} size="lg" />
        </div>

        {/* Fact matrix */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-card-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-surface-border)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Organization
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)', marginTop: '0.2rem' }}>
              {bid.tenderingAuthority || 'Not specified'}
            </div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.15rem', fontFamily: 'var(--font-mono)' }}>
              № {bid.tenderNumber}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Estimated Value
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)', marginTop: '0.2rem' }}>
              {bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : 'Not specified'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Submission Deadline
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: deadlineColor, marginTop: '0.2rem' }}>
              {deadlineLabel}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Added to Pipeline
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)', marginTop: '0.2rem' }}>
              {formatDate(bid.createdAt)}
            </div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.15rem' }}>
              Updated {formatDate(bid.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
