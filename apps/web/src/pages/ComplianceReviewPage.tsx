import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComplianceItem, reviewComplianceItem, type ComplianceItem } from '../api/compliance.js';
import { useApi } from '../hooks/useApi.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { ProvenanceCard } from '../components/compliance/ProvenanceCard.js';
import { ExecutionRulesCard } from '../components/compliance/ExecutionRulesCard.js';
import { ReviewActions } from '../components/compliance/ReviewActions.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const ComplianceReviewPage: React.FC = () => {
  const { id: bidId = '', itemId = '' } = useParams<{ id: string; itemId: string }>();
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchItem = useCallback(() => getComplianceItem(bidId, itemId), [bidId, itemId]);
  const { data: item, isLoading, error, refetch, setData: setItem } = useApi<ComplianceItem>(fetchItem, [bidId, itemId]);

  const handleReview = async (status: 'READY' | 'FLAGGED' | 'WAIVED', notes?: string) => {
    if (!item) return;
    setActionError(null);

    // Optimistic UI update
    const previous = item;
    setItem((prev) =>
      prev
        ? {
            ...prev,
            status,
            reviewNotes: notes || prev.reviewNotes,
            version: prev.version + 1,
          }
        : null,
    );

    const res = await reviewComplianceItem(bidId, itemId, {
      status,
      notes,
      expectedVersion: item.version,
    });

    if (!res.ok) {
      setItem(previous);
      setActionError(res.error.message || 'Failed to update review status.');
    } else {
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <LoadingSkeleton height="40px" />
        <LoadingSkeleton height="150px" />
        <LoadingSkeleton height="200px" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <ErrorBanner message={error?.message || 'Compliance item not found'} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to={`/bids/${bidId}`} style={{ color: 'var(--color-surface-muted)', fontSize: '0.9rem' }}>
          ← Back to Bid Project
        </Link>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}

      {/* Header section */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-primary-100)',
                border: '1px solid var(--color-surface-border)',
                textTransform: 'uppercase',
              }}
            >
              {item.category} Compliance
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-surface-text)', marginTop: '0.5rem' }}>
              {item.title}
            </h2>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <p style={{ fontSize: '0.95rem', color: 'var(--color-surface-text)', lineHeight: 1.6 }}>
          {item.description}
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-surface-subtle)', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-surface-border)' }}>
          <div>
            <strong>Version:</strong> {item.version}
          </div>
          <div>
            <strong>Human Review Required:</strong> {item.humanReviewRequired ? 'Yes (Mandatory)' : 'No'}
          </div>
          {item.reviewedAt && (
            <div>
              <strong>Reviewed:</strong> {item.reviewedAt}
            </div>
          )}
        </div>
      </div>

      {/* Provenance Card */}
      {item.provenance && <ProvenanceCard provenance={item.provenance} />}

      {/* Execution & Statutory Rules */}
      {item.executionRules && <ExecutionRulesCard executionRules={item.executionRules} />}

      {/* Review Notes (if already reviewed) */}
      {item.reviewNotes && (
        <div
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-surface-text)', marginBottom: '0.5rem' }}>
            Reviewer Remarks & Notes
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-surface-text)' }}>
            {item.reviewNotes}
          </p>
        </div>
      )}

      {/* Review Actions Footer */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
          Update Review Decision:
        </span>
        <ReviewActions currentStatus={item.status} onReview={handleReview} />
      </div>
    </div>
  );
};
