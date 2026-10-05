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
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
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
          boxShadow: 'var(--shadow-sm)',
        };
    }
  };

  const getPaddingStyles = (): string => {
    switch (padding) {
      case 'none':
        return '0';
      case 'sm':
        return 'var(--space-3)';
      case 'lg':
        return 'var(--space-6)';
      case 'md':
      default:
        return 'var(--space-5)';
    }
  };

  return (
    <div
      className={`card card-${variant} ${className}`}
      style={{
        borderRadius: 'var(--radius-lg)',
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
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
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
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--font-semibold)' as unknown as number,
        color: 'var(--color-surface-text)',
        letterSpacing: '-0.01em',
        lineHeight: 'var(--leading-tight)',
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
        fontSize: 'var(--text-sm)',
        color: 'var(--color-surface-muted)',
        lineHeight: 'var(--leading-normal)',
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
        gap: 'var(--space-3)',
        marginTop: 'var(--space-4)',
        paddingTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-surface-border)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
