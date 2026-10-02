import React from 'react';

export type ComplianceStatusFilterValue = 'ALL' | 'FLAGGED' | 'READY' | 'PENDING' | 'WAIVED';

export interface StatusFilterProps {
  value: ComplianceStatusFilterValue;
  onChange: (value: ComplianceStatusFilterValue) => void;
  counts?: {
    ALL: number;
    FLAGGED: number;
    READY: number;
    PENDING: number;
    WAIVED: number;
  };
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  value,
  onChange,
  counts,
}) => {
  const options: { label: string; value: ComplianceStatusFilterValue; color?: string }[] = [
    { label: 'All Items', value: 'ALL' },
    { label: 'Flagged (Action Req.)', value: 'FLAGGED', color: 'var(--color-danger)' },
    { label: 'Ready', value: 'READY', color: 'var(--color-success)' },
    { label: 'Pending', value: 'PENDING', color: 'var(--color-warning)' },
    { label: 'Waived', value: 'WAIVED' },
  ];

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        const count = counts ? counts[opt.value] : null;

        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              border: `1px solid ${isActive ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
              backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface-card)',
              color: isActive ? 'var(--color-surface-text)' : 'var(--color-surface-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>{opt.label}</span>
            {count != null && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: opt.color
                    ? `color-mix(in srgb, ${opt.color} 20%, transparent)`
                    : 'var(--color-surface-input)',
                  color: opt.color || 'inherit',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
