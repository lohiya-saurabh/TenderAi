import React from 'react';

export type CardVariant = 'default' | 'interactive' | 'bordered' | 'flat' | 'subtle';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'interactive':
        return {
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px 0 rgba(0, 0, 0, 0.06))',
          cursor: 'pointer',
          transition: 'all var(--transition-fast, 150ms cubic-bezier(0.4, 0, 0.2, 1))',
        };
      case 'bordered':
        return {
          backgroundColor: 'transparent',
          border: '1px solid var(--color-surface-border)',
          boxShadow: 'none',
        };
      case 'flat':
      case 'subtle':
        return {
          backgroundColor: 'var(--color-surface-card-subtle)',
          border: '1px solid transparent',
          boxShadow: 'none',
        };
      case 'default':
      default:
        return {
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px 0 rgba(0, 0, 0, 0.04))',
        };
    }
  };

  const getPaddingStyles = (): string => {
    switch (padding) {
      case 'none':
        return '0';
      case 'sm':
        return 'var(--space-3, 0.75rem)';
      case 'lg':
        return 'var(--space-6, 1.5rem)';
      case 'md':
      default:
        return 'var(--space-5, 1.25rem)';
    }
  };

  return (
    <div
      className={`card card-${variant} ${className}`}
      style={{
        borderRadius: 'var(--radius-lg, 0.75rem)',
        padding: getPaddingStyles(),
        display: 'flex',
        flexDirection: 'column',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  action,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`card-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3, 0.75rem)',
        marginBottom: 'var(--space-3, 0.75rem)',
        ...style,
      }}
      {...props}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4' | 'h5';
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  as: Component = 'h3',
  className = '',
  style,
  ...props
}) => {
  return (
    <Component
      className={`card-title ${className}`}
      style={{
        fontSize: 'var(--text-lg, 1.125rem)',
        fontWeight: 'var(--font-semibold, 600)' as unknown as number,
        color: 'var(--color-surface-text)',
        letterSpacing: '-0.01em',
        lineHeight: 'var(--leading-tight, 1.25)',
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <p
      className={`card-description ${className}`}
      style={{
        fontSize: 'var(--text-sm, 0.875rem)',
        color: 'var(--color-surface-muted)',
        lineHeight: 'var(--leading-normal, 1.5)',
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`card-content ${className}`}
      style={{
        flex: 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`card-footer ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 'var(--space-3, 0.75rem)',
        marginTop: 'var(--space-4, 1rem)',
        paddingTop: 'var(--space-3, 0.75rem)',
        borderTop: '1px solid var(--color-surface-border)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
