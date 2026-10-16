import React from 'react';
import type { BidDetail } from '@/api/bids.js';
import type { ComplianceItem } from '@/api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card.js';
import { Badge } from '@/components/common/Badge.js';
import { StatusBadge } from '@/components/common/StatusBadge.js';
import { computeReadiness } from '@/utils/readiness.js';
import { getComplianceRollup } from '@/components/bid/detail/bidDetailData.js';

export interface ReadinessCardProps {
  bid: BidDetail;
  items: ComplianceItem[];
}

/**
 * Bid readiness.
 *
 * Real rollup only: approved / extracted requirements and
 * the requirement-matrix status distribution. The full
 * 4-pillar readiness model (evidence completeness, risk
 * clearance, deadline buffer, EMD affordability) requires
 * the Company Profile and evaluation engine — both
 * documented as missing APIs.
 */
export const ReadinessCard: React.FC<ReadinessCardProps> = ({ bid, items }) => {
  const rollup = getComplianceRollup(items, bid);

  // Directly derive live readiness from compliance items when available to prevent desynchronization
  const readiness = React.useMemo(() => {
    if (items && items.length > 0) {
      const total = items.length;
      const approved = rollup.ready;
      const flagged = rollup.flagged;
      return {
        total,
        approved,
        flagged,
        pct: total > 0 ? Math.min(100, Math.max(0, Math.round((approved / total) * 100))) : null,
      };
    }
    return computeReadiness(bid);
  }, [items, bid, rollup.ready, rollup.flagged]);

  const pct = readiness.pct;

  const barColor =
    pct === null
      ? 'var(--color-surface-border)'
      : pct >= 80
        ? 'var(--color-success)'
        : pct >= 50
          ? 'var(--color-warning)'
          : 'var(--color-primary-500)';

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          pct === null ? (
            <Badge variant="neutral" size="sm">
              Pending intake
            </Badge>
          ) : (
            <Badge variant={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'primary'} size="sm">
              {pct}% ready
            </Badge>
          )
        }
      >
        <CardTitle as="h3">Bid Readiness</CardTitle>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Requirement review progress — share of requirements approved
        </p>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Progress */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.4rem',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
                {pct === null
                  ? 'No requirements extracted yet'
                  : `${pct}% of requirements approved`}
              </span>
              <span style={{ color: 'var(--color-surface-muted)' }}>
                {readiness.approved}/{readiness.total}
              </span>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--color-surface-border)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Requirement review progress"
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct ?? 0}%`,
                  backgroundColor: barColor,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width var(--transition-normal)',
                }}
              />
            </div>
          </div>

          {/* Status distribution */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <DistributionStat label="Ready" count={rollup.ready} status="READY" />
            <DistributionStat label="Flagged" count={rollup.flagged} status="FLAGGED" />
            <DistributionStat label="Pending review" count={rollup.pending} status="PENDING" />
            <DistributionStat label="Waived" count={rollup.waived} status="WAIVED" />
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-2xs)',
              color: 'var(--color-surface-subtle)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            The full readiness model — evidence completeness, risk clearance, deadline buffer, and
            EMD affordability — evaluates the Company Capability Profile and has no backend API yet
            (see missing endpoints below).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

function DistributionStat({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: string;
}) {
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-surface-card-subtle)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-surface-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <StatusBadge status={status} size="sm" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
        <span
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            color: 'var(--color-surface-text)',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
