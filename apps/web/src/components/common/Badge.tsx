import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  dot = false,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): { bg: string; color: string; border: string; dotColor: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: 'rgba(99, 102, 241, 0.15)',
          color: '#818cf8',
          border: 'rgba(99, 102, 241, 0.3)',
          dotColor: '#6366f1',
        };
      case 'success':
        return {
          bg: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          border: 'var(--color-success-border)',
          dotColor: '#10b981',
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
          border: 'var(--color-warning-border)',
          dotColor: '#f59e0b',
        };
      case 'danger':
        return {
          bg: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          border: 'var(--color-danger-border)',
          dotColor: '#ef4444',
        };
      case 'info':
        return {
          bg: 'var(--color-info-bg)',
          color: 'var(--color-info)',
          border: 'var(--color-info-border)',
          dotColor: '#3b82f6',
        };
      case 'secondary':
        return {
          bg: 'var(--color-surface-card-hover)',
          color: 'var(--color-surface-text)',
          border: 'var(--color-surface-border)',
          dotColor: '#94a3b8',
        };
      case 'neutral':
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.1)',
          color: 'var(--color-surface-muted)',
          border: 'rgba(148, 163, 184, 0.25)',
          dotColor: '#64748b',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '0.15rem 0.45rem', fontSize: 'var(--text-2xs)', dotSize: 6 };
      case 'lg':
        return { padding: '0.35rem 0.8rem', fontSize: 'var(--text-sm)', dotSize: 8 };
      case 'md':
      default:
        return { padding: '0.2rem 0.6rem', fontSize: 'var(--text-xs)', dotSize: 7 };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <span
      className={`badge badge-${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: sStyles.padding,
        fontSize: sStyles.fontSize,
        fontWeight: 'var(--font-semibold)' as unknown as number,
        borderRadius: 'var(--radius-full)',
        backgroundColor: vStyles.bg,
        color: vStyles.color,
        border: `1px solid ${vStyles.border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: sStyles.dotSize,
            height: sStyles.dotSize,
            borderRadius: '50%',
            backgroundColor: vStyles.dotColor,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      {icon}
      <span>{children}</span>
    </span>
  );
};
