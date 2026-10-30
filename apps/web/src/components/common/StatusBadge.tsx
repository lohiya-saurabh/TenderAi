import React from 'react';
import { Badge, type BadgeVariant } from '@/components/common/Badge.js';
import {
  PassIcon,
  FailIcon,
  MissingIcon,
  ReviewRequiredIcon,
  NotApplicableIcon,
  SpinnerIcon,
  IconProps,
} from '@/components/common/Icons.js';

export type SemanticStatusVariant =
  'PASS' | 'FAIL' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';

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
  | 'QUEUED_FOR_EXTRACTION'
  | 'EXTRACTING'
  | 'COMPLETED'
  | 'PROCESSED'
  | 'DEAD_LETTER'
  | 'FINALIZED';

export type StatusVariant = SemanticStatusVariant | LegacyStatusVariant | string;

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  iconOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface StatusVisualConfig {
  tone: BadgeVariant;
  icon: React.ComponentType<IconProps> | null;
  defaultLabel: string;
}

const words = (s: string) =>
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

function visualConfig(normalized: string): StatusVisualConfig {
  switch (normalized) {
    case 'PASS':
    case 'READY':
    case 'EXTRACTED':
    case 'SUBMITTED':
    case 'FINALIZED':
    case 'COMPLETED':
    case 'PROCESSED':
      return { tone: 'success', icon: PassIcon, defaultLabel: words(normalized) };
    case 'FAIL':
    case 'FLAGGED':
    case 'FAILED':
    case 'DEAD_LETTER':
      return { tone: 'danger', icon: FailIcon, defaultLabel: words(normalized) };
    case 'MISSING':
    case 'PENDING':
    case 'PENDING_UPLOAD':
      return { tone: 'warning', icon: MissingIcon, defaultLabel: words(normalized) };
    case 'REVIEW_REQUIRED':
    case 'REVIEW_READY':
      return { tone: 'warning', icon: ReviewRequiredIcon, defaultLabel: 'Review required' };
    case 'ANALYZING':
    case 'PROCESSING':
    case 'QUEUED':
    case 'QUEUED_FOR_EXTRACTION':
    case 'EXTRACTING':
      return {
        tone: 'primary',
        icon: SpinnerIcon,
        defaultLabel: normalized === 'QUEUED_FOR_EXTRACTION' ? 'Queued' : words(normalized),
      };
    case 'NOT_APPLICABLE':
      return { tone: 'neutral', icon: NotApplicableIcon, defaultLabel: 'N/A' };
    default:
      return { tone: 'neutral', icon: null, defaultLabel: words(normalized || 'Unknown') };
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  iconOnly = false,
  className,
  style,
}) => {
  const config = visualConfig((status || '').toUpperCase().trim());
  const Icon = config.icon;
  const displayLabel = label || config.defaultLabel;
  const iconSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return (
    <Badge
      role="status"
      aria-label={`Status: ${displayLabel}`}
      title={displayLabel}
      variant={config.tone}
      size={size}
      className={className}
      style={style}
      icon={showIcon && Icon ? <Icon size={iconSize} color="currentColor" /> : undefined}
    >
      {iconOnly ? <span className="sr-only">{displayLabel}</span> : displayLabel}
    </Badge>
  );
};
