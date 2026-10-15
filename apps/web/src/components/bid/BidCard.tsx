import React from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '@/api/bids.js';
import { BidStatusBadge } from '@/components/bid/BidStatusBadge.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { formatDate } from '@/utils/formatDate.js';

export interface BidCardProps {
  bid: BidSummary;
}

export const BidCard: React.FC<BidCardProps> = ({ bid }) => {
  return (
    <Link
      to={`/bids/${bid.id}`}
      style={{
        display: 'block',
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        transition: 'all var(--transition-fast)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary-500)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-surface-border)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--color-surface-text)',
            lineHeight: 1.4,
          }}
        >
          {bid.title}
        </h3>
        <BidStatusBadge status={bid.status} />
      </div>

      <div
        style={{
          fontSize: '0.85rem',
          color: 'var(--color-surface-muted)',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        <div>
          <strong style={{ color: 'var(--color-surface-text)' }}>Tender №:</strong>{' '}
          {bid.tenderNumber}
        </div>
        <div>
          <strong style={{ color: 'var(--color-surface-text)' }}>Authority:</strong>{' '}
          {bid.tenderingAuthority}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-surface-border)',
          fontSize: '0.8rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--color-surface-subtle)' }}>Est. Value</div>
          <div style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
            {bid.estimatedValueRupees != null ? formatCurrency(bid.estimatedValueRupees) : '—'}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-surface-subtle)' }}>Deadline</div>
          <div style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
            {bid.submissionDeadline ? formatDate(bid.submissionDeadline) : '—'}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-surface-subtle)' }}>Requirements</div>
          <div style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
            {bid.totalRequirements != null ? (
              <span>
                {bid.approvedRequirements || 0}/{bid.totalRequirements}{' '}
                {bid.flaggedRequirements ? (
                  <span style={{ color: 'var(--color-danger)' }}>
                    ({bid.flaggedRequirements} flagged)
                  </span>
                ) : null}
              </span>
            ) : (
              'Not analyzed'
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
