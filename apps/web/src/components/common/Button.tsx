import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--color-primary-600)',
          color: '#ffffff',
          border: '1px solid var(--color-primary-500)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--color-surface-card)',
          color: 'var(--color-surface-text)',
          border: '1px solid var(--color-surface-border)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--color-danger)',
          color: '#ffffff',
          border: '1px solid var(--color-danger-hover)',
        };
      case 'success':
        return {
          backgroundColor: 'var(--color-success)',
          color: '#ffffff',
          border: '1px solid #059669',
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
        return { padding: '0.25rem 0.6rem', fontSize: '0.8125rem' };
      case 'lg':
        return { padding: '0.75rem 1.5rem', fontSize: '1.05rem' };
      case 'md':
      default:
        return { padding: '0.5rem 1rem', fontSize: '0.9rem' };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontWeight: 500,
        borderRadius: 'var(--radius-md)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: 'all var(--transition-fast)',
        fontFamily: 'inherit',
        outline: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: '1em',
            height: '1em',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'shimmer 0.8s linear infinite',
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
