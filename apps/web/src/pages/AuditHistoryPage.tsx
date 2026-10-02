import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listAuditEvents, type AuditEvent } from '../api/audit.js';
import { useApi } from '../hooks/useApi.js';
import { AuditTimeline } from '../components/audit/AuditTimeline.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const AuditHistoryPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const fetchEvents = useCallback(() => listAuditEvents(id), [id]);
  const { data: events, isLoading, error, refetch } = useApi<AuditEvent[]>(fetchEvents, [id]);

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to={`/bids/${id}`} style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
          ← Back to Bid Project
        </Link>
      </div>

      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-surface-text)' }}>
          Tamper-Evident Audit Trail
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
          Cryptographically recorded timeline of all document extractions, human approvals, waivers, and state transitions.
        </p>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refetch} />}

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <LoadingSkeleton height="90px" />
          <LoadingSkeleton height="90px" />
          <LoadingSkeleton height="90px" />
        </div>
      ) : (
        <AuditTimeline events={events || []} />
      )}
    </div>
  );
};
