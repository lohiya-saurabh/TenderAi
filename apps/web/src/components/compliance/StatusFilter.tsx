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
  PASS: 'var(--status-pass-text)',
  FAIL: 'var(--status-fail-text)',
  MISSING: 'var(--status-missing-text)',
  REVIEW_REQUIRED: 'var(--status-review-text)',
  NOT_APPLICABLE: 'var(--status-na-text)',
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const count = counts ? counts[opt.value] : null;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
              isActive
                ? 'bg-foreground text-background border-foreground font-semibold shadow-xs'
                : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/50 font-medium'
            }`}
          >
            <span>{opt.label}</span>
            {count != null && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground'
                }`}
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