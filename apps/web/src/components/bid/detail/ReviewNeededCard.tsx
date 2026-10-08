import React from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceItem } from '../../../api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../common/Card.js';
import { Badge } from '../../common/Badge.js';
import { StatusBadge } from '../../common/StatusBadge.js';
import {
  ReviewRequiredIcon,
  CheckIcon,
  ChevronRightIcon,
} from '../../common/Icons.js';
import { getReviewNeededItems } from './bidDetailData.js';

export interface ReviewNeededCardProps {
  items: ComplianceItem[];
}

/**
 * Review tasks.
 *
 * Real signals only: requirements with status PENDING
 * (not yet reviewed) or explicitly marked
 * humanReviewRequired. Each item deep-links to the
 * dedicated compliance review page, which performs the
 * actual review with optimistic concurrency control.
 *
 * The dedicated ReviewTask / human-in-the-loop API
 * (assignments, SLAs, threaded comments) has no backend
 * endpoint yet — documented in MissingDataCallout.
 */
export const ReviewNeededCard: React.FC<ReviewNeededCardProps> = ({ items }) => {
  const reviewNeeded = getReviewNeededItems(items);

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          <Badge variant={reviewNeeded.length > 0 ? 'warning' : 'success'} size="sm">
            {reviewNeeded.length} Task{reviewNeeded.length === 1 ? '' : 's'}
          </Badge>
        }
      >
        <CardTitle as="h3">Review Tasks</CardTitle>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Requirements awaiting human compliance review
        </p>
      </CardHeader>

      <CardContent>
        {reviewNeeded.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-border)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckIcon size={14} />
            </span>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                All caught up
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
                Every extracted requirement has been reviewed.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reviewNeeded.map((item) => {
                const title = (item as { title?: string }).title || item.requirement;
                return (
              <Link
                key={item.id}
                to={`/bids/${item.bidId}/compliance/${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface-card-subtle)',
                  border: '1px solid var(--color-surface-border)',
                  textDecoration: 'none',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-subtle)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  <span style={{ color: 'var(--color-warning)', display: 'inline-flex', flexShrink: 0 }}>
                    <ReviewRequiredIcon size={15} />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                      {title}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
                      {item.category}
                      {item.humanReviewRequired ? ' • flagged for human review' : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <StatusBadge status={item.status} size="sm" />
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
