import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 2rem',
        backgroundColor: 'var(--color-surface-card)',
        border: '1px dashed var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: '2.5rem',
            marginBottom: '1rem',
            color: 'var(--color-primary-500)',
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--color-surface-text)',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--color-surface-muted)',
          maxWidth: '450px',
          marginBottom: action ? '1.5rem' : '0',
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
};
