import React from 'react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  label?: string; // Custom label to override the default level label
}

const riskConfigs: Record<RiskLevel, { bg: string; color: string; border: string; label: string }> = {
  LOW: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: 'var(--color-success)',
    border: 'rgba(16, 185, 129, 0.3)',
    label: 'Low',
  },
  MEDIUM: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: 'var(--color-warning)',
    border: 'rgba(245, 158, 11, 0.3)',
    label: 'Medium',
  },
  HIGH: {
    bg: 'rgba(249, 115, 22, 0.12)',
    color: '#f97316',
    border: 'rgba(249, 115, 22, 0.3)',
    label: 'High',
  },
  CRITICAL: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--color-danger)',
    border: 'rgba(239, 68, 68, 0.3)',
    label: 'Critical',
  },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'sm', showLabel = true, label }) => {
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