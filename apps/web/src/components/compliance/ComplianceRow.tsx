import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceItem } from '../../api/compliance.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { ProvenanceCard } from './ProvenanceCard.js';
import { ExecutionRulesCard } from './ExecutionRulesCard.js';
import { ReviewActions } from './ReviewActions.js';

export interface ComplianceRowProps {
  item: ComplianceItem;
  onReview: (itemId: string, status: 'READY' | 'FLAGGED' | 'WAIVED', notes?: string) => Promise<void>;
}

export const ComplianceRow: React.FC<ComplianceRowProps> = ({ item, onReview }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const handleRowReview = async (status: 'READY' | 'FLAGGED' | 'WAIVED', notes?: string) => {
    setIsReviewing(true);
    try {
      await onReview(item.id, status, notes);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'border-color var(--transition-fast)',
      }}
    >
      {/* Main Row summary */}
      <div
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          cursor: 'pointer',
          backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-surface-muted)' }}>
            {isExpanded ? '▼' : '▶'}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-input)',
                  color: 'var(--color-primary-100)',
                  border: '1px solid var(--color-surface-border)',
                }}
              >
                {item.category}
              </span>
              <h4
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--color-surface-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.title}
              </h4>
            </div>

            <p
              style={{
                fontSize: '0.825rem',
                color: 'var(--color-surface-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: isExpanded ? 'normal' : 'nowrap',
              }}
            >
              {item.description}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={item.status} />

          <Link
            to={`/bids/${item.bidId}/compliance/${item.id}`}
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-primary-500)',
              fontWeight: 500,
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-surface-border)',
            }}
          >
            Details ↗
          </Link>
        </div>
      </div>

      {/* Expanded details section */}
      {isExpanded && (
        <div
          style={{
            padding: '1.25rem',
            borderTop: '1px solid var(--color-surface-border)',
            backgroundColor: 'var(--color-surface-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {item.provenance && <ProvenanceCard provenance={item.provenance} />}
          {item.executionRules && <ExecutionRulesCard executionRules={item.executionRules} />}

          {item.reviewNotes && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-surface-border)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ color: 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>
                <strong>Reviewer Notes:</strong>
              </div>
              <div style={{ color: 'var(--color-surface-text)' }}>{item.reviewNotes}</div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-surface-border)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-surface-subtle)' }}>
              Version {item.version} • {item.reviewedAt ? `Reviewed on ${item.reviewedAt}` : 'Awaiting Review'}
            </div>

            <ReviewActions
              currentStatus={item.status}
              onReview={handleRowReview}
              isLoading={isReviewing}
            />
          </div>
        </div>
      )}
    </div>
  );
};
