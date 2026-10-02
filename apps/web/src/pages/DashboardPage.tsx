import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { listBids, type BidSummary } from '../api/bids.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { BidCard } from '../components/bid/BidCard.js';
import { Button } from '../components/common/Button.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const DashboardPage: React.FC = () => {
  const { data: bids, isLoading, error, refetch } = useApi<BidSummary[]>(listBids);
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>('');

  const canCreateBid = hasPermission(PERMISSIONS.BIDS_CREATE);

  const filteredBids = (bids || []).filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tenderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.tenderingAuthority.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
            Tender Bids Dashboard
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
            Track active tenders, extraction pipelines, and compliance verification.
          </p>
        </div>

        {canCreateBid && (
          <Link to="/bids/new">
            <Button variant="primary" icon={<span>➕</span>}>
              New Bid Project
            </Button>
          </Link>
        )}
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refetch} />}

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter by title, tender number, or tendering authority..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            maxWidth: '450px',
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-surface-text)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.9rem',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Content list */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          <LoadingSkeleton height="180px" borderRadius="var(--radius-lg)" />
          <LoadingSkeleton height="180px" borderRadius="var(--radius-lg)" />
          <LoadingSkeleton height="180px" borderRadius="var(--radius-lg)" />
        </div>
      ) : filteredBids.length === 0 ? (
        bids && bids.length > 0 ? (
          <EmptyState
            title="No bids match your search"
            description="Try clearing your search query to see all tenant bids."
          />
        ) : (
          <EmptyState
            icon="📁"
            title="No Tender Bid Projects Yet"
            description="Create your first bid project to upload tender specifications and generate AI compliance checklists."
            action={
              canCreateBid ? (
                <Link to="/bids/new">
                  <Button variant="primary">Create First Bid</Button>
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredBids.map((bid) => (
            <BidCard key={bid.id} bid={bid} />
          ))}
        </div>
      )}
    </div>
  );
};
