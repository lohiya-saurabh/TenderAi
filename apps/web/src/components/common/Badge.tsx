import React from 'react';

export type BadgeVariant =
  'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

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
          bg: 'var(--color-surface-card-subtle)',
          color: 'var(--color-surface-text)',
          border: 'var(--color-surface-border)',
          dotColor: 'var(--color-surface-text)',
        };
      case 'success':
        return {
          bg: 'var(--status-pass-bg)',
          color: 'var(--status-pass-text)',
          border: 'var(--status-pass-border)',
          dotColor: 'var(--status-pass-text)',
        };
      case 'warning':
        return {
          bg: 'var(--status-amber-bg)',
          color: 'var(--status-amber-text)',
          border: 'var(--status-amber-border)',
          dotColor: '#ea580c',
        };
      case 'danger':
        return {
          bg: 'var(--status-flag-bg)',
          color: 'var(--status-flag-text)',
          border: 'var(--status-flag-border)',
          dotColor: 'var(--vermilion, #f0441c)',
        };
      case 'info':
        return {
          bg: 'var(--color-surface-card-subtle)',
          color: 'var(--color-surface-text)',
          border: 'var(--color-surface-border)',
          dotColor: 'var(--color-surface-text)',
        };
      case 'secondary':
        return {
          bg: 'var(--color-surface-card-hover)',
          color: 'var(--color-surface-text)',
          border: 'var(--color-surface-border)',
          dotColor: 'var(--color-surface-subtle)',
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--color-surface-card-subtle)',
          color: 'var(--color-surface-muted)',
          border: 'var(--color-surface-border)',
          dotColor: 'var(--color-surface-subtle)',
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
