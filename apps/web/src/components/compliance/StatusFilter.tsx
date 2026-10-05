import React from 'react';

export type ComplianceStatusFilterValue =
  | 'ALL'
  | 'PASS'
  | 'FAIL'
  | 'MISSING'
  | 'REVIEW_REQUIRED'
  | 'NOT_APPLICABLE';

export interface StatusFilterProps {
  value: ComplianceStatusFilterValue;
  onChange: (value: ComplianceStatusFilterValue) => void;
  counts?: Record<ComplianceStatusFilterValue, number>;
}

const statusColors: Record<Exclude<ComplianceStatusFilterValue, 'ALL'>, string> = {
  PASS: 'var(--color-success)',
  FAIL: 'var(--color-danger)',
  MISSING: 'var(--color-warning)',
  REVIEW_REQUIRED: 'var(--color-primary-500)',
  NOT_APPLICABLE: 'var(--color-surface-muted)',
};

export const StatusFilter: React.FC<StatusFilterProps> = ({
  value,
  onChange,
  counts,
}) => {
  const options: { value: ComplianceStatusFilterValue; label: string; color?: string }[] = [
    { label: 'All Items', value: 'ALL' },
    { label: 'Pass', value: 'PASS', color: statusColors.PASS },
    { label: 'Fail', value: 'FAIL', color: statusColors.FAIL },
    { label: 'Missing', value: 'MISSING', color: statusColors.MISSING },
    { label: 'Review Required', value: 'REVIEW_REQUIRED', color: statusColors.REVIEW_REQUIRED },
    { label: 'Not Applicable', value: 'NOT_APPLICABLE', color: statusColors.NOT_APPLICABLE },
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