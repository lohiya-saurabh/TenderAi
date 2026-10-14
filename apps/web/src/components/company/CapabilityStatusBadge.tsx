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
          bg: 'var(--status-pass-bg)',
          color: 'var(--status-pass-text)',
          border: '1px solid var(--status-pass-border)',
        };
      case 'IMPORTED':
        return {
          defaultLabel: 'Imported',
          icon: PassIcon,
          bg: 'var(--color-surface-card-subtle)',
          color: 'var(--color-surface-text)',
          border: '1px solid var(--color-surface-border)',
        };
      case 'EXTRACTED':
        return {
          defaultLabel: 'Extracted',
          icon: ReviewRequiredIcon,
          bg: 'var(--status-review-bg)',
          color: 'var(--status-review-text)',
          border: '1px solid var(--status-review-border)',
        };
      case 'EXPIRING_SOON':
        return {
          defaultLabel: 'Expiring Soon',
          icon: HighRiskIcon,
          bg: 'var(--status-flag-bg)',
          color: 'var(--status-flag-text)',
          border: '1px solid var(--status-flag-border)',
        };
      case 'EXPIRED':
        return {
          defaultLabel: 'Expired',
          icon: FailIcon,
          bg: 'var(--status-fail-bg)',
          color: 'var(--status-fail-text)',
          border: '1px solid var(--status-fail-border)',
        };
      case 'REJECTED':
        return {
          defaultLabel: 'Rejected',
          icon: FailIcon,
          bg: 'var(--status-fail-bg)',
          color: 'var(--status-fail-text)',
          border: '1px solid var(--status-fail-border)',
        };
      case 'MISSING':
        return {
          defaultLabel: 'Missing',
          icon: MissingIcon,
          bg: 'var(--status-na-bg)',
          color: 'var(--color-surface-muted)',
          border: '1px dashed var(--color-surface-border)',
        };
      case 'NEEDS_REVIEW':
        return {
          defaultLabel: 'Needs Review',
          icon: ReviewRequiredIcon,
          bg: 'var(--status-review-bg)',
          color: 'var(--status-review-text)',
          border: '1px solid var(--status-review-border)',
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
