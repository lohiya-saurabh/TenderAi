import React, { useState } from 'react';
import { AlertCircleIcon, CloseIcon } from '@/components/common/Icons.js';
import { Button } from '@/components/common/Button.js';

export interface ErrorBannerProps {
  message: string;
  details?: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  details,
  onRetry,
  onDismiss,
  className = '',
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      className={`error-banner ${className}`}
      style={{
        backgroundColor: 'hsl(var(--destructive) / 0.08)',
        border: '1px solid hsl(var(--destructive) / 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1.15rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
        margin: '0.75rem 0',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1 }}>
        <span
          style={{
            color: 'hsl(var(--destructive))',
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: '0.15rem',
            flexShrink: 0,
          }}
        >
          <AlertCircleIcon size={18} color="hsl(var(--destructive))" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          <span
            style={{
              color: 'hsl(var(--foreground))',
              fontWeight: 'var(--font-medium)' as unknown as number,
              fontSize: 'var(--text-sm)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            {message}
          </span>
          {details != null && typeof details === 'object' && (
            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: 'var(--text-2xs)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  marginTop: '0.2rem',
                }}
              >
                {showDetails ? 'Hide error details' : 'Show technical error details'}
              </button>
              {showDetails && (
                <pre
                  style={{
                    fontSize: 'var(--text-2xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'hsl(var(--muted-foreground))',
                    backgroundColor: 'hsl(var(--background))',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '0.4rem',
                    overflowX: 'auto',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {onRetry && (
          <Button variant="danger" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  minHeight?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  minHeight = '280px',
}) => {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight,
        textAlign: 'center',
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'hsl(var(--destructive) / 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <AlertCircleIcon size={24} color="hsl(var(--destructive))" />
      </div>
      <h3
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)' as unknown as number,
          color: 'hsl(var(--foreground))',
          marginBottom: '0.25rem',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'hsl(var(--muted-foreground))',
          maxWidth: '420px',
          marginBottom: onRetry ? '1rem' : '0',
          lineHeight: 'var(--leading-normal)',
        }}
      >
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};
