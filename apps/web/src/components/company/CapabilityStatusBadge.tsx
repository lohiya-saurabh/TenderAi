import React from 'react';
import {
  PassIcon,
  FailIcon,
  MissingIcon,
  ReviewRequiredIcon,
  HighRiskIcon,
} from '../common/Icons.js';
import type { CapabilityStatus } from './companyProfileData.js';

export interface CapabilityStatusBadgeProps {
  status: CapabilityStatus;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showIcon?: boolean;
}

export const CapabilityStatusBadge: React.FC<CapabilityStatusBadgeProps> = ({
  status,
  size = 'md',
  label,
  showIcon = true,
}) => {
  const getConfig = () => {
    switch (status) {
      case 'VERIFIED':
      case 'SOURCE_VERIFIED':
        return {
          defaultLabel: status === 'SOURCE_VERIFIED' ? 'Source Verified' : 'Verified',
          icon: PassIcon,
          bg: 'rgba(16, 185, 129, 0.12)',
          color: 'var(--color-success)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
        };
      case 'IMPORTED':
        return {
          defaultLabel: 'Imported',
          icon: PassIcon,
          bg: 'rgba(59, 130, 246, 0.12)',
          color: 'var(--color-info, #3b82f6)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
        };
      case 'EXTRACTED':
        return {
          defaultLabel: 'Extracted',
          icon: ReviewRequiredIcon,
          bg: 'rgba(139, 92, 246, 0.12)',
          color: '#a78bfa',
          border: '1px solid rgba(139, 92, 246, 0.35)',
        };
      case 'EXPIRING_SOON':
        return {
          defaultLabel: 'Expiring Soon',
          icon: HighRiskIcon,
          bg: 'rgba(245, 158, 11, 0.14)',
          color: 'var(--color-warning)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
        };
      case 'EXPIRED':
        return {
          defaultLabel: 'Expired',
          icon: FailIcon,
          bg: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
        };
      case 'REJECTED':
        return {
          defaultLabel: 'Rejected',
          icon: FailIcon,
          bg: 'rgba(239, 68, 68, 0.18)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.45)',
        };
      case 'MISSING':
        return {
          defaultLabel: 'Missing',
          icon: MissingIcon,
          bg: 'rgba(107, 114, 128, 0.14)',
          color: 'var(--color-surface-muted)',
          border: '1px dashed var(--color-surface-border)',
        };
      case 'NEEDS_REVIEW':
        return {
          defaultLabel: 'Needs Review',
          icon: ReviewRequiredIcon,
          bg: 'rgba(99, 102, 241, 0.14)',
          color: 'var(--color-primary-300)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  const fontSizes = {
    sm: 'var(--text-2xs)',
    md: 'var(--text-xs)',
    lg: 'var(--text-sm)',
  };

  const paddings = {
    sm: '0.15rem 0.45rem',
    md: '0.25rem 0.6rem',
    lg: '0.35rem 0.8rem',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: paddings[size],
        fontSize: fontSizes[size],
        fontWeight: 700,
        borderRadius: 'var(--radius-sm)',
        backgroundColor: config.bg,
        color: config.color,
        border: config.border,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
    >
      {showIcon && <IconComponent size={iconSizes[size]} color={config.color} />}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
};
