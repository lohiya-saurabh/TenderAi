import React from 'react';
import {
  PassIcon,
  FailIcon,
  MissingIcon,
  ReviewRequiredIcon,
  HighRiskIcon,
} from '@/components/common/Icons.js';
import { Badge, type BadgeVariant } from '@/components/common/Badge.js';
import type { CapabilityStatus } from '@/components/company/companyProfileData.js';

export interface CapabilityStatusBadgeProps {
  status: CapabilityStatus;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showIcon?: boolean;
}

const CONFIG: Record<
  CapabilityStatus,
  { label: string; icon: typeof PassIcon; variant: BadgeVariant }
> = {
  VERIFIED: { label: 'Verified', icon: PassIcon, variant: 'success' },
  SOURCE_VERIFIED: { label: 'Source verified', icon: PassIcon, variant: 'success' },
  UNVERIFIED: { label: 'Unverified', icon: MissingIcon, variant: 'neutral' },
  IMPORTED: { label: 'Imported', icon: PassIcon, variant: 'secondary' },
  EXTRACTED: { label: 'Extracted', icon: ReviewRequiredIcon, variant: 'primary' },
  EXPIRING_SOON: { label: 'Expiring soon', icon: HighRiskIcon, variant: 'warning' },
  EXPIRED: { label: 'Expired', icon: FailIcon, variant: 'danger' },
  REJECTED: { label: 'Rejected', icon: FailIcon, variant: 'danger' },
  MISSING: { label: 'Missing', icon: MissingIcon, variant: 'neutral' },
  NEEDS_REVIEW: { label: 'Needs review', icon: ReviewRequiredIcon, variant: 'warning' },
};

const ICON_SIZE = { sm: 12, md: 14, lg: 16 };

export const CapabilityStatusBadge: React.FC<CapabilityStatusBadgeProps> = ({
  status,
  size = 'md',
  label,
  showIcon = true,
}) => {
  const { label: defaultLabel, icon: Icon, variant } = CONFIG[status];
  return (
    <Badge
      role="status"
      variant={variant}
      size={size}
      icon={showIcon ? <Icon size={ICON_SIZE[size]} /> : undefined}
    >
      {label || defaultLabel}
    </Badge>
  );
};
