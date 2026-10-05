import React from 'react';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = 'var(--content-max-width)',
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`page-container ${className}`}
      style={{
        width: '100%',
        maxWidth,
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-8)',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badge,
  className = '',
  style,
}) => {
  return (
    <header
      className={`page-header ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
        ...style,
      }}
    >
      {breadcrumbs && <div className="page-breadcrumbs">{breadcrumbs}</div>}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <h1
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)' as unknown as number,
              color: 'var(--color-surface-text)',
              letterSpacing: '-0.02em',
              lineHeight: 'var(--leading-tight)',
            }}
          >
            {title}
          </h1>
          {badge}
        </div>

        {actions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-surface-muted)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {subtitle}
        </div>
      )}
    </header>
  );
};

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  level?: 'h2' | 'h3' | 'h4';
  className?: string;
  style?: React.CSSProperties;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actions,
  level: Component = 'h2',
  className = '',
  style,
}) => {
  return (
    <div
      className={`section-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
    >
      <div>
        <Component
          style={{
            fontSize: Component === 'h2' ? 'var(--text-xl)' : 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)' as unknown as number,
            color: 'var(--color-surface-text)',
            letterSpacing: '-0.01em',
            lineHeight: 'var(--leading-tight)',
          }}
        >
          {title}
        </Component>
        {description && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
              marginTop: '0.25rem',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
};

export interface PageGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4 | 'sidebar-main';
  gap?: 'sm' | 'md' | 'lg';
}

export const PageGrid: React.FC<PageGridProps> = ({
  children,
  columns = 1,
  gap = 'md',
  className = '',
  style,
  ...props
}) => {
  const getGap = () => {
    switch (gap) {
      case 'sm':
        return 'var(--space-3)';
      case 'lg':
        return 'var(--space-6)';
      case 'md':
      default:
        return 'var(--space-4)';
    }
  };

  const getTemplateColumns = () => {
    if (columns === 'sidebar-main') {
      return 'minmax(280px, 340px) 1fr';
    }
    switch (columns) {
      case 2:
        return 'repeat(auto-fit, minmax(320px, 1fr))';
      case 3:
        return 'repeat(auto-fit, minmax(280px, 1fr))';
      case 4:
        return 'repeat(auto-fit, minmax(220px, 1fr))';
      case 1:
      default:
        return '1fr';
    }
  };

  return (
    <div
      className={`page-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: getTemplateColumns(),
        gap: getGap(),
        width: '100%',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
