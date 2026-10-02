import React from 'react';
import type { AuditEvent } from '../../api/audit.js';
import { formatDateTime } from '../../utils/formatDate.js';
import { EmptyState } from '../common/EmptyState.js';

export interface AuditTimelineProps {
  events: AuditEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <EmptyState
        icon="📜"
        title="No audit events recorded"
        description="Every lifecycle transition and human review action on this bid will appear here in chronological order."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.5rem' }}>
      {/* Vertical line */}
      <div
        style={{
          position: 'absolute',
          left: '7px',
          top: '10px',
          bottom: '10px',
          width: '2px',
          backgroundColor: 'var(--color-surface-border)',
        }}
      />

      {events.map((event) => (
        <div key={event.id} style={{ position: 'relative' }}>
          {/* Timeline node */}
          <div
            style={{
              position: 'absolute',
              left: '-1.5rem',
              top: '4px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-500)',
              border: '3px solid var(--color-surface-bg)',
            }}
          />

          <div
            style={{
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--color-primary-100)',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {event.eventType}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
                {formatDateTime(event.timestamp)}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-text)', marginBottom: '0.5rem' }}>
              <strong>User:</strong> {event.userName || event.userId} • <strong>Aggregate:</strong>{' '}
              {event.aggregateType} ({event.aggregateId})
            </div>

            {event.payload && Object.keys(event.payload).length > 0 && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-surface-muted)',
                  backgroundColor: 'var(--color-surface-bg)',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
