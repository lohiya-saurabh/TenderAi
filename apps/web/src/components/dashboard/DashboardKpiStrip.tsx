import React from 'react';
import type { BidSummary } from '../../api/bids.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { Card } from '../common/Card.js';
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-4)',
      }}
    >
      {/* 1. Active Pipeline Count */}
      <Card variant="default" padding="sm" style={{ borderLeft: '4px solid var(--color-primary-500)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Pipeline
          </span>
          <span style={{ color: 'var(--color-primary-400)' }}>
            <TendersIcon size={16} />
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-surface-text)', lineHeight: 1.2 }}>
          {activeBids.length}
        </div>
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.35rem' }}>
          {bids.filter((b) => b.status === 'REVIEW_READY').length} ready for human review
        </div>
      </Card>

      {/* 2. Total Contract Value */}
      <Card variant="default" padding="sm" style={{ borderLeft: '4px solid var(--color-success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Value (INR)
          </span>
          <span style={{ color: 'var(--color-success)' }}>
            <CheckIcon size={16} />
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-surface-text)', lineHeight: 1.2 }}>
          {formatCurrency(totalValue)}
        </div>
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.35rem' }}>
          Across {activeBids.length} prospective tenders
        </div>
      </Card>

      {/* 3. Action Required Items */}
      <Card
        variant="default"
        padding="sm"
        style={{
          borderLeft: totalFlagged > 0 ? '4px solid var(--color-danger)' : '4px solid var(--color-surface-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Compliance Flags
          </span>
          <span style={{ color: totalFlagged > 0 ? 'var(--color-danger)' : 'var(--color-surface-subtle)' }}>
            <AlertCircleIcon size={16} />
          </span>
        </div>
        <div
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: totalFlagged > 0 ? 'var(--color-danger)' : 'var(--color-surface-text)',
            lineHeight: 1.2,
          }}
        >
          {totalFlagged}
        </div>
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.35rem' }}>
          {totalFlagged > 0 ? 'Clauses requiring verification or proof' : 'No disqualifying flags'}
        </div>
      </Card>

      {/* 4. Urgent Deadlines (< 7 days) */}
      <Card
        variant="default"
        padding="sm"
        style={{
          borderLeft: urgentDeadlines.length > 0 ? '4px solid var(--color-warning)' : '4px solid var(--color-surface-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Imminent Deadlines
          </span>
          <span style={{ color: urgentDeadlines.length > 0 ? 'var(--color-warning)' : 'var(--color-surface-subtle)' }}>
            <WarningIcon size={16} />
          </span>
        </div>
        <div
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: urgentDeadlines.length > 0 ? 'var(--color-warning)' : 'var(--color-surface-text)',
            lineHeight: 1.2,
          }}
        >
          {urgentDeadlines.length}
        </div>
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', marginTop: '0.35rem' }}>
          Submissions due within 7 days
        </div>
      </Card>
    </div>
  );
};
