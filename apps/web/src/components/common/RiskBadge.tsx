import React from 'react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  label?: string; // Custom label to override the default level label
}

const riskConfigs: Record<RiskLevel, { bg: string; color: string; border: string; label: string }> =
  {
    LOW: {
      bg: 'var(--status-pass-bg)',
      color: 'var(--status-pass-text)',
      border: 'var(--status-pass-border)',
      label: 'Low',
    },
    MEDIUM: {
      bg: 'rgba(234, 88, 12, 0.08)',
      color: '#ea580c',
      border: 'rgba(234, 88, 12, 0.25)',
      label: 'Medium',
    },
    HIGH: {
      bg: 'rgba(234, 88, 12, 0.14)',
      color: '#c2410c',
      border: 'rgba(234, 88, 12, 0.35)',
      label: 'High',
    },
    CRITICAL: {
      bg: 'rgba(194, 65, 12, 0.18)',
      color: '#9a3412',
      border: 'rgba(194, 65, 12, 0.45)',
      label: 'Critical',
    },
  };

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'sm',
  showLabel = true,
  label,
}) => {
  const config = riskConfigs[level];
  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '0.25rem' : '0.35rem',
        padding: isSmall ? '0.15rem 0.5rem' : '0.25rem 0.65rem',
        borderRadius: 'var(--radius-full)',
        fontSize: isSmall ? '0.7rem' : '0.8rem',
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: isSmall ? '6px' : '7px',
          height: isSmall ? '6px' : '7px',
          borderRadius: '50%',
          backgroundColor: config.color,
        }}
      />
      {showLabel && <span>{label || config.label}</span>}
    </span>
  );
};
