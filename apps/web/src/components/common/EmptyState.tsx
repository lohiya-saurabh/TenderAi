import React from 'react';

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
  className = '',
  style,
}) => {
  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? 'var(--space-6) var(--space-4)' : 'var(--space-12) var(--space-6)',
        backgroundColor: 'var(--color-surface-card)',
        border: '1px dashed var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: compact ? '2rem' : '2.75rem',
            marginBottom: 'var(--space-3)',
            color: 'var(--color-primary-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: compact ? 'var(--text-base)' : 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)' as unknown as number,
          color: 'var(--color-surface-text)',
          marginBottom: 'var(--space-1-5)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-surface-muted)',
          maxWidth: '460px',
          marginBottom: action || secondaryAction ? 'var(--space-5)' : '0',
          lineHeight: 'var(--leading-normal)',
        }}
      >
        {description}
      </p>
      {(action || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
