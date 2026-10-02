import React from 'react';

export type StatusVariant =
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
  | 'FAILED';

export interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const normalized = status.toUpperCase();

  const getColorConfig = (): { bg: string; color: string; border: string } => {
    switch (normalized) {
      case 'READY':
      case 'EXTRACTED':
      case 'SUBMITTED':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'FLAGGED':
      case 'FAILED':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
        };
      case 'PENDING':
      case 'PENDING_UPLOAD':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
        };
      case 'ANALYZING':
      case 'PROCESSING':
      case 'QUEUED':
        return {
          bg: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
        };
      case 'REVIEW_READY':
        return {
          bg: 'rgba(99, 102, 241, 0.15)',
          color: '#818cf8',
          border: 'rgba(99, 102, 241, 0.3)',
        };
      case 'WAIVED':
      case 'ARCHIVED':
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.12)',
          color: '#94a3b8',
          border: 'rgba(148, 163, 184, 0.3)',
        };
    }
  };

  const config = getColorConfig();
  const padding = size === 'sm' ? '0.15rem 0.45rem' : '0.25rem 0.65rem';
  const fontSize = size === 'sm' ? '0.7rem' : '0.75rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        fontSize,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderRadius: 'var(--radius-full)',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label || normalized.replace(/_/g, ' ')}
    </span>
  );
};
