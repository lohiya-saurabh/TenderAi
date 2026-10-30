import React from 'react';
import { cn } from '@/lib/utils.js';

/** The one empty state: what is missing, why, and the next step. */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  style,
}) => (
  <div
    className={cn(
      'flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-center',
      compact ? 'px-4 py-6' : 'px-6 py-12',
      className,
    )}
    style={style}
  >
    {icon && (
      <div
        className="mb-3 flex items-center justify-center text-muted-foreground [&_svg]:h-8 [&_svg]:w-8"
        aria-hidden="true"
      >
        {icon}
      </div>
    )}
    <h3 className={cn('mb-1.5 font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
      {title}
    </h3>
    <p
      className={cn(
        'max-w-md text-sm text-muted-foreground',
        (action || secondaryAction) && 'mb-5',
      )}
    >
      {description}
    </p>
    {(action || secondaryAction) && (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {action}
        {secondaryAction}
      </div>
    )}
  </div>
);
