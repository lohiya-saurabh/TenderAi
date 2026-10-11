import React from 'react';
import { SpinnerIcon } from './Icons.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  startIcon,
  endIcon,
  fullWidth = false,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--btn-primary-bg, var(--color-surface-text))',
          color: 'var(--btn-primary-text, var(--color-surface-bg))',
          border: '1px solid var(--btn-primary-bg, var(--color-surface-text))',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--color-surface-card)',
          color: 'var(--color-surface-text)',
          border: '1px solid var(--color-surface-border)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-surface-text)',
          border: '1px solid var(--color-surface-border)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--color-danger)',
          color: '#ffffff',
          border: '1px solid var(--color-danger)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--status-amber-bg, rgba(234, 88, 12, 0.12))',
          color: 'var(--status-amber-text, #fb923c)',
          border: '1px solid var(--status-amber-border, rgba(251, 146, 60, 0.3))',
        };
      case 'success':
        return {
          backgroundColor: 'var(--status-pass-bg, var(--color-surface-card-subtle))',
          color: 'var(--status-pass-text, var(--color-surface-text))',
          border: '1px solid var(--status-pass-border, var(--color-surface-border))',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-surface-muted)',
          border: '1px solid transparent',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '0.3rem 0.65rem',
          fontSize: 'var(--text-xs)',
          gap: '0.375rem',
          height: '32px',
        };
      case 'lg':
        return {
          padding: '0.65rem 1.35rem',
          fontSize: 'var(--text-base)',
          gap: '0.6rem',
          height: '46px',
        };
      case 'md':
      default:
        return {
          padding: '0.45rem 1rem',
          fontSize: 'var(--text-sm)',
          gap: '0.5rem',
          height: '38px',
        };
    }
  };

  const effectiveStartIcon = startIcon || icon;

  return (
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full-width' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'var(--font-medium)' as unknown as number,
        borderRadius: 'var(--radius-md)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: 'all var(--transition-fast)',
        fontFamily: 'inherit',
        outline: 'none',
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : 'auto',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <SpinnerIcon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : (
        effectiveStartIcon
      )}
      {children}
      {!isLoading && endIcon}
    </button>
  );
};
