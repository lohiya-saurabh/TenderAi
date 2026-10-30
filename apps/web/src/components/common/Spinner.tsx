import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7', xl: 'h-9 w-9' };

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label = 'Loading…',
  className,
  style,
}) => (
  <div
    role="status"
    aria-label={label}
    className={cn('inline-flex items-center justify-center', className)}
    style={style}
  >
    <Loader2 className={cn('animate-spin text-primary', SIZE[size])} aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  minHeight?: string;
}

/** The one full-section loading state. */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading…',
  subtext,
  minHeight = '240px',
}) => (
  <div
    className="flex flex-col items-center justify-center gap-3 p-8 text-center"
    style={{ minHeight }}
  >
    <Spinner size="lg" />
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </div>
  </div>
);
