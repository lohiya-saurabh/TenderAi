import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/common/Button.js';
import { cn } from '@/lib/utils.js';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Inline error for a failed action or load: the message in words, never raw error data. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  onDismiss,
  className,
  style,
}) => (
  <div
    role="alert"
    className={cn(
      'my-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3',
      className,
    )}
    style={style}
  >
    <div className="flex flex-1 items-start gap-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  minHeight?: string;
}

/** Full-section error state, the counterpart of EmptyState and LoadingState. */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  minHeight = '280px',
}) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center"
    style={{ minHeight }}
  >
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
    </div>
    <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
    <p className={cn('max-w-md text-sm text-muted-foreground', onRetry && 'mb-4')}>{message}</p>
    {onRetry && (
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);
