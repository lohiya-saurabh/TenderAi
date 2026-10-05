import React from 'react';
import {
  InfoIcon,
  CheckIcon,
  WarningIcon,
  AlertCircleIcon,
  CloseIcon,
  IconProps,
} from './Icons.js';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface AlertVisualConfig {
  bg: string;
  border: string;
  color: string;
  icon: React.ComponentType<IconProps>;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
  style,
}) => {
  const getVisualConfig = (): AlertVisualConfig => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--color-success-bg)',
          border: 'var(--color-success-border)',
          color: 'var(--color-success)',
          icon: CheckIcon,
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-bg)',
          border: 'var(--color-warning-border)',
          color: 'var(--color-warning)',
          icon: WarningIcon,
        };
      case 'danger':
        return {
          bg: 'var(--color-danger-bg)',
          border: 'var(--color-danger-border)',
          color: 'var(--color-danger)',
          icon: AlertCircleIcon,
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-info-bg)',
          border: 'var(--color-info-border)',
          color: 'var(--color-info)',
          icon: InfoIcon,
        };
    }
  };

  const config = getVisualConfig();
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={`alert alert-${variant} ${className}`}
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1.15rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        color: 'var(--color-surface-text)',
        fontSize: 'var(--text-sm)',
        lineHeight: 'var(--leading-normal)',
        ...style,
      }}
    >
      <span
        style={{
          color: config.color,
          display: 'inline-flex',
          alignItems: 'center',
          marginTop: '0.15rem',
          flexShrink: 0,
        }}
      >
        <IconComponent size={18} color={config.color} />
      </span>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {title && (
          <h4
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)' as unknown as number,
              color: 'var(--color-surface-text)',
            }}
          >
            {title}
          </h4>
        )}
        <div style={{ color: 'var(--color-surface-text)' }}>{children}</div>
      </div>

      {(action || onDismiss) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {action}
          {onDismiss && (
            <button
              onClick={onDismiss}
              aria-label="Dismiss alert"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-surface-muted)',
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
      )}
    </div>
  );
};
