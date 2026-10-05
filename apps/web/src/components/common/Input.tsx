import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  startIcon,
  endIcon,
  fullWidth = true,
  id,
  style,
  className = '',
  required,
  disabled,
  ...props
}) => {
  const generatedId = React.useId();
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `input-${generatedId}`);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div
      className={`input-group ${fullWidth ? 'w-full' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)' as unknown as number,
            color: 'var(--color-surface-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {label}
          {required && (
            <span style={{ color: 'var(--color-danger)' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {startIcon && (
          <span
            style={{
              position: 'absolute',
              left: '0.75rem',
              color: 'var(--color-surface-muted)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {startIcon}
          </span>
        )}

        <input
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          className={`input-field ${className}`}
          style={{
            backgroundColor: 'var(--color-surface-input)',
            color: 'var(--color-surface-text)',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-surface-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: `0.55rem ${endIcon ? '2.25rem' : '0.8rem'} 0.55rem ${startIcon ? '2.25rem' : '0.8rem'}`,
            fontSize: 'var(--text-sm)',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            width: '100%',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            ...style,
          }}
          {...props}
        />

        {endIcon && (
          <span
            style={{
              position: 'absolute',
              right: '0.75rem',
              color: 'var(--color-surface-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {endIcon}
          </span>
        )}
      </div>

      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-danger)',
            fontWeight: 'var(--font-medium)' as unknown as number,
          }}
        >
          {error}
        </span>
      )}
      {!error && helperText && (
        <span
          id={helperId}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};
