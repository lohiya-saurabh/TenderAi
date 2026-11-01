import React from 'react';
import { Badge, type BadgeVariant } from '@/components/common/Badge.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  label?: string; // Custom label to override the default level label
}

const RISK: Record<RiskLevel, { tone: BadgeVariant; label: string }> = {
  LOW: { tone: 'success', label: 'Low' },
  MEDIUM: { tone: 'warning', label: 'Medium' },
  HIGH: { tone: 'danger', label: 'High' },
  CRITICAL: { tone: 'danger', label: 'Critical' },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  size = 'sm',
  showLabel = true,
  label,
}) => {
  const { tone, label: fallback } = RISK[level];
  const text = label || fallback;
  return (
    <Badge variant={tone} size={size} dot title={text}>
      {showLabel ? text : <span className="sr-only">{text}</span>}
    </Badge>
  );
};
