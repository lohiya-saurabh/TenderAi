import React, { useState } from 'react';
import { Card } from '../common/Card.js';
import { InfoIcon, ChevronDownIcon } from '../common/Icons.js';

interface MissingEndpoint {
  method: string;
  path: string;
  purpose: string;
  blocks: string;
}

/**
 * Documented missing backend endpoints.
 *
 * Every dashboard section renders exclusively from existing APIs:
 * - GET /api/v1/bids (tenant list)
 * - GET /api/v1/bids/:id/compliance-items (per-bid, N+1 — documented below)
 * - GET /api/v1/bids/:id/bid-decision (per-bid, N+1 — decision endpoint exists;
 *   the list projection is the documented gap)
 *
 * The endpoints below do not exist yet — they are recorded here
 * instead of being simulated with invented data.
 */
const MISSING_ENDPOINTS: MissingEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/dashboard/metrics',
    purpose: 'Pre-aggregated tenant KPIs (active volume, total exposure in INR, urgent deadlines).',
    blocks: 'KPI strip is computed client-side from GET /api/v1/bids — acceptable today, does not scale past ~1,000 bids.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids?page=&limit=&sort=',
    purpose: 'Server-side pagination, sorting, and filtering of the tender list (includes embedded bid-decision projection to eliminate N+1 per-row fetch).',
    blocks: 'Tender List paginates, sorts, and filters in client memory from the full GET /api/v1/bids response. Bid decisions are fetched per-row (N+1) until a list projection ships.',
  },
  {
    method: 'GET',
    path: '/api/v1/dashboard/action-items',
    purpose: 'Tenant-level aggregated action stream (flagged clauses, required reviews, incomplete intake).',
    blocks: 'Action Required currently issues one compliance-items request per active bid (N+1).',
  },
  {
    method: 'GET',
    path: '/api/v1/company-profile',
    purpose: 'Company Capability Profile aggregate — registrations, certifications, audited financials, past work orders.',
    blocks: 'Company Readiness section renders an honest "not available" state instead of profile metrics.',
  },
  {
    method: 'GET',
    path: '/api/v1/company-profile/expiring-certificates',
    purpose: 'Certificate and license expiry watch (e.g. renewals within 30 days).',
    blocks: '"Expiring certificate" action items cannot be shown.',
  },
  {
    method: 'GET',
    path: '/api/v1/tenders/amendments',
    purpose: 'Corrigendum / amendment notification stream with scope and date changes.',
    blocks: '"Tender amendment" action items cannot be shown.',
  },
];

export const MissingApiCallout: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card variant="flat" padding="sm" style={{ border: '1px solid var(--color-surface-border)' }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
          color: 'var(--color-surface-muted)',
          fontSize: 'var(--text-xs)',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <InfoIcon size={14} color="var(--color-primary-400)" />
          <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
            Architecture Note: Data Sources & Documented Missing Endpoints
          </span>
        </div>
        <ChevronDownIcon
          size={14}
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {isExpanded && (
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-surface-border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-muted)',
            lineHeight: 1.5,
          }}
        >
          <p style={{ marginBottom: '0.5rem' }}>
            To adhere strictly to <em>zero invented backend data</em>, every metric,
            action item, and deadline on this dashboard is computed in client memory
            from the live{' '}
            <code style={{ color: 'var(--color-primary-300)' }}>GET /api/v1/bids</code>{' '}
            and{' '}
            <code style={{ color: 'var(--color-primary-300)' }}>
              GET /api/v1/bids/:id/compliance-items
            </code>{' '}
            endpoints. Signals the backend does not expose yet are listed below — not simulated.
          </p>
          <div style={{ fontWeight: 600, color: 'var(--color-surface-text)', marginBottom: '0.35rem' }}>
            Missing Target Endpoints ({MISSING_ENDPOINTS.length}):
          </div>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {MISSING_ENDPOINTS.map((endpoint) => (
              <li key={endpoint.path}>
                <code style={{ color: 'var(--color-primary-300)' }}>
                  {endpoint.method} {endpoint.path}
                </code>
                <span> — {endpoint.purpose}</span>
                <span style={{ display: 'block', color: 'var(--color-surface-subtle)', fontSize: 'var(--text-2xs)' }}>
                  Current gap: {endpoint.blocks}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
