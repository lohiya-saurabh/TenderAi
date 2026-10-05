import React from 'react';
import {
  PassIcon,
  FailIcon,
  MissingIcon,
  ReviewRequiredIcon,
  NotApplicableIcon,
  SpinnerIcon,
  IconProps,
} from './Icons.js';

export type SemanticStatusVariant =
  | 'PASS'
  | 'FAIL'
  | 'MISSING'
  | 'REVIEW_REQUIRED'
  | 'NOT_APPLICABLE';

export type LegacyStatusVariant =
  | 'PENDING'
  | 'READY'
  | 'FLAGGED'
  | 'WAIVED'
  | 'DRAFT'
  | 'ANALYZING'
  | 'REVIEW_READY'
  | 'SUBMITTED'
  | 'ARCHIVED'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'EXTRACTED'
  | 'FAILED'
  | 'QUEUED'
  | 'FINALIZED';

export type StatusVariant = SemanticStatusVariant | LegacyStatusVariant | string;

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface StatusVisualConfig {
  bg: string;
  color: string;
  border: string;
  icon: React.ComponentType<IconProps> | null;
  defaultLabel: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
  style,
}) => {
  const normalized = (status || '').toUpperCase().trim();

  const getVisualConfig = (): StatusVisualConfig => {
    switch (normalized) {
      // 1. Canonical PASS / Ready
      case 'PASS':
      case 'READY':
      case 'EXTRACTED':
      case 'SUBMITTED':
      case 'FINALIZED':
        return {
          bg: 'var(--status-pass-bg)',
          color: 'var(--status-pass-text)',
          border: 'var(--status-pass-border)',
          icon: PassIcon,
          defaultLabel: normalized === 'PASS' ? 'Pass' : normalized.replace(/_/g, ' '),
        };

      // 2. Canonical FAIL / Flagged
      case 'FAIL':
      case 'FLAGGED':
      case 'FAILED':
        return {
          bg: 'var(--status-fail-bg)',
          color: 'var(--status-fail-text)',
          border: 'var(--status-fail-border)',
          icon: FailIcon,
          defaultLabel: normalized === 'FAIL' ? 'Fail' : normalized.replace(/_/g, ' '),
        };

      // 3. Canonical MISSING / Pending Action
      case 'MISSING':
      case 'PENDING':
      case 'PENDING_UPLOAD':
        return {
          bg: 'var(--status-missing-bg)',
          color: 'var(--status-missing-text)',
          border: 'var(--status-missing-border)',
          icon: MissingIcon,
          defaultLabel: normalized === 'MISSING' ? 'Missing' : normalized.replace(/_/g, ' '),
        };

      // 4. Canonical REVIEW_REQUIRED / Review Ready
      case 'REVIEW_REQUIRED':
      case 'REVIEW_READY':
        return {
          bg: 'var(--status-review-bg)',
          color: 'var(--status-review-text)',
          border: 'var(--status-review-border)',
          icon: ReviewRequiredIcon,
          defaultLabel: 'Review Required',
        };

      // In-flight processing
      case 'ANALYZING':
      case 'PROCESSING':
      case 'QUEUED':
        return {
          bg: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
          icon: SpinnerIcon,
          defaultLabel: normalized.replace(/_/g, ' '),
        };

      // 5. Canonical NOT_APPLICABLE / Waived / Archived
      case 'NOT_APPLICABLE':
      case 'WAIVED':
      case 'ARCHIVED':
      case 'DRAFT':
      default:
        return {
          bg: 'var(--status-na-bg)',
          color: 'var(--status-na-text)',
          border: 'var(--status-na-border)',
          icon: normalized === 'NOT_APPLICABLE' ? NotApplicableIcon : null,
          defaultLabel: normalized === 'NOT_APPLICABLE' ? 'N/A' : (normalized || 'Unknown').replace(/_/g, ' '),
        };
    }
  };

  const config = getVisualConfig();
  const IconComponent = config.icon;

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: '0.15rem 0.45rem',
          fontSize: 'var(--text-2xs)',
          iconSize: 11,
          gap: '0.3rem',
        };
      case 'lg':
        return {
          padding: '0.35rem 0.85rem',
          fontSize: 'var(--text-sm)',
          iconSize: 16,
          gap: '0.45rem',
        };
      case 'md':
      default:
        return {
          padding: '0.22rem 0.65rem',
          fontSize: 'var(--text-xs)',
          iconSize: 13,
          gap: '0.375rem',
        };
    }
  };

  const sizeStyle = getSizeStyles();
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      role="status"
      aria-label={`Status: ${displayLabel}`}
      className={`status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyle.gap,
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: 'var(--font-semibold)' as unknown as number,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderRadius: 'var(--radius-full)',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {showIcon && IconComponent && (
        <IconComponent size={sizeStyle.iconSize} color={config.color} />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
