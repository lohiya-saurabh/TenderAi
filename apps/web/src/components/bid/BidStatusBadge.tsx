import React from 'react';
import { StatusBadge } from '@/components/common/StatusBadge.js';

export interface BidStatusBadgeProps {
  status: 'DRAFT' | 'ANALYZING' | 'REVIEW_READY' | 'SUBMITTED' | 'ARCHIVED';
  size?: 'sm' | 'md';
}

export const BidStatusBadge: React.FC<BidStatusBadgeProps> = ({ status, size = 'md' }) => {
  return <StatusBadge status={status} size={size} />;
};
