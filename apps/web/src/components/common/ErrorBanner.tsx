import React from 'react';

export interface ErrorBannerProps {
  message: string;
  details?: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  details,
  onRetry,
  onDismiss,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>⚠️</span>
          <span style={{ color: 'var(--color-surface-text)', fontWeight: 500, fontSize: '0.9rem' }}>
            {message}
          </span>
        </div>
        {details != null && typeof details === 'object' && (
          <pre
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-surface-muted)',
              backgroundColor: 'var(--color-surface-bg)',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              marginTop: '0.5rem',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--color-surface-muted)',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
