import React from 'react';
import { SpinnerIcon } from '@/components/common/Icons.js';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'var(--color-primary-500)',
  label = 'Loading...',
  className = '',
  style,
}) => {
  const getPixelSize = (): number => {
    switch (size) {
      case 'sm':
        return 16;
      case 'lg':
        return 28;
      case 'xl':
        return 38;
      case 'md':
      default:
        return 22;
    }
  };

  return (
    <div
      role="status"
      aria-label={label}
      className={`spinner-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <SpinnerIcon size={getPixelSize()} color={color} />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  minHeight?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  subtext,
  minHeight = '240px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        minHeight,
        textAlign: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <Spinner size="lg" color="var(--color-primary-500)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)' as unknown as number,
            color: 'var(--color-surface-text)',
          }}
        >
          {message}
        </p>
        {subtext && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
