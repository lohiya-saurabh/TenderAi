import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  style,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-surface-text)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          backgroundColor: 'var(--color-surface-input)',
          color: 'var(--color-surface-text)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-surface-border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0.55rem 0.8rem',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          width: '100%',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>{error}</span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-surface-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
