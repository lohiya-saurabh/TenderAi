import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';
import {
  PassIcon,
  FailIcon,
  MissingIcon,
  ReviewRequiredIcon,
  NotApplicableIcon,
  type IconProps,
} from '../common/Icons.js';
import { Lock, Info } from 'lucide-react';
import type { ComplianceItem } from '../../api/compliance.js';

export interface ReviewActionsProps {
  currentStatus: ComplianceItem['status'];
  onReview: (status: ComplianceItem['status'], notes?: string, expectedVersion?: number) => Promise<void>;
  isLoading?: boolean;
  expectedVersion?: number;
  layout?: 'row' | 'card';
}

export interface ReviewActionOption {
  value: ComplianceItem['status'];
  actionLabel: string;
  statusLabel: string;
  variant: 'success' | 'danger' | 'secondary' | 'primary' | 'outline';
  description: string;
  impact: string;
  requiresRationale: boolean;
  icon: React.FC<IconProps>;
}

export const REVIEW_ACTION_OPTIONS: readonly ReviewActionOption[] = [
  {
    value: 'PASS',
    actionLabel: 'Approve',
    statusLabel: 'Pass',
    variant: 'success',
    description: 'Requirement fully satisfied with verified evidence.',
    impact: 'Marks clause as verified. Contributes positively to overall Bid Readiness score.',
    requiresRationale: false,
    icon: PassIcon,
  },
  {
    value: 'FAIL',
    actionLabel: 'Reject',
    statusLabel: 'Fail',
    variant: 'danger',
    description: 'Requirement not met, evidence disqualified, or hard gap.',
    impact: 'Marks clause as non-compliant. If mandatory, this may disqualify the bid.',
    requiresRationale: true,
    icon: FailIcon,
  },
  {
    value: 'MISSING',
    actionLabel: 'Request Evidence',
    statusLabel: 'Missing Evidence',
    variant: 'secondary',
    description: 'Evidence document is not yet attached or needs re-acquisition.',
    impact: 'Pushes item to Missing Evidence acquisition queue.',
    requiresRationale: false,
    icon: MissingIcon,
  },
  {
    value: 'REVIEW_REQUIRED',
    actionLabel: 'Mark Uncertain',
    statusLabel: 'Needs Clarification',
    variant: 'primary',
    description: 'Ambiguous wording or requires legal / technical lead escalation.',
    impact: 'Keeps clause flagged for cross-functional review and pre-bid inquiry.',
    requiresRationale: true,
    icon: ReviewRequiredIcon,
  },
  {
    value: 'NOT_APPLICABLE',
    actionLabel: 'Waive (N/A)',
    statusLabel: 'Not Applicable',
    variant: 'outline',
    description: 'Clause does not apply to bidder scope or consortium structure.',
    impact: 'Excludes requirement from readiness denominator.',
    requiresRationale: true,
    icon: NotApplicableIcon,
  },
] as const;

export const ReviewActions: React.FC<ReviewActionsProps> = ({
  currentStatus,
  onReview,
  isLoading = false,
  expectedVersion,
  layout = 'row',
}) => {
  const { hasPermission, user } = useAuth();
  const canReview = hasPermission(PERMISSIONS.COMPLIANCE_REVIEW);

  const [selectedAction, setSelectedAction] = useState<ReviewActionOption | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!canReview) {
    return (
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-surface-muted)',
          backgroundColor: 'var(--color-surface-bg)',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-surface-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <Lock size={14} className="shrink-0" />
        <span>
          Read-only view. Adjudication requires <code>compliance:review</code> permission.
        </span>
      </div>
    );
  }

  const handleOpenModal = (opt: ReviewActionOption) => {
    setSelectedAction(opt);
    setNotes('');
    setValidationError(null);
  };

  const handleConfirm = async () => {
    if (!selectedAction) return;

    if (selectedAction.requiresRationale && !notes.trim()) {
      setValidationError('Please provide a brief justification for this decision.');
      return;
    }

    try {
      await onReview(selectedAction.value, notes.trim() || undefined, expectedVersion);
      setSelectedAction(null);
      setNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record review decision';
      setValidationError(msg);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'card' ? 'column' : 'row',
        gap: '0.75rem',
        alignItems: layout === 'card' ? 'stretch' : 'center',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          width: layout === 'card' ? '100%' : 'auto',
        }}
      >
        {REVIEW_ACTION_OPTIONS.map((opt) => {
          const isCurrent = currentStatus === opt.value;
          const IconComponent = opt.icon;

          return (
            <Button
              key={opt.value}
              variant={opt.variant}
              size="sm"
              disabled={isLoading || isCurrent}
              onClick={() => handleOpenModal(opt)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: isCurrent ? 0.45 : 1,
                cursor: isCurrent ? 'default' : 'pointer',
              }}
              title={isCurrent ? `Current status is already ${opt.statusLabel}` : opt.description}
            >
              <IconComponent size={14} />
              <span>{opt.actionLabel}</span>
            </Button>
          );
        })}
      </div>

      {selectedAction && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAction(null)}
          title={`Confirm Decision: ${selectedAction.actionLabel}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedAction(null)} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant={selectedAction.variant}
                onClick={handleConfirm}
                isLoading={isLoading}
              >
                Confirm {selectedAction.actionLabel}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Status Change Summary Box */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-bg)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', display: 'block' }}>
                  Current Status
                </span>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)' }}>
                  {currentStatus}
                </strong>
              </div>
              <span style={{ fontSize: 'var(--text-lg)', color: 'var(--color-surface-muted)' }}>→</span>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', display: 'block' }}>
                  New Human Verdict
                </span>
                <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary-300)' }}>
                  {selectedAction.statusLabel} ({selectedAction.value})
                </strong>
              </div>
            </div>

            {/* Impact description */}
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-surface-text)',
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: '0 0 0.5rem' }}>{selectedAction.description}</p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
                <strong>Impact:</strong> {selectedAction.impact}
              </p>
            </div>

            {/* Reviewer Note Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--color-surface-text)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Reviewer Rationale / Remarks{' '}
                  {selectedAction.requiresRationale ? (
                    <span style={{ color: 'var(--color-danger)' }}>* (Required)</span>
                  ) : (
                    <span style={{ color: 'var(--color-surface-muted)' }}>(Optional)</span>
                  )}
                </span>
                {user?.email && (
                  <span style={{ color: 'var(--color-surface-muted)', fontWeight: 400 }}>
                    Reviewer: {user.email}
                  </span>
                )}
              </label>
              <textarea
                placeholder={
                  selectedAction.requiresRationale
                    ? 'State the specific basis or discrepancy (e.g. CA UDIN confirmed on ICAI portal; turnover meets threshold).'
                    : 'Add any optional notes or reference citations for the bid team...'
                }
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                rows={3}
                style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${validationError ? 'var(--color-danger)' : 'var(--color-surface-border)'}`,
                  backgroundColor: 'var(--color-surface-input)',
                  color: 'var(--color-surface-text)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '80px',
                  outline: 'none',
                }}
              />
              {validationError && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
                  {validationError}
                </span>
              )}
            </div>

            {/* Audit Notice */}
            <div
              style={{
                fontSize: 'var(--text-2xs)',
                color: 'var(--color-surface-muted)',
                backgroundColor: 'var(--color-surface-card)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--color-primary-500)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Info size={14} className="text-primary shrink-0" />
              <span>
                This adjudication is recorded immutably in the compliance audit ledger with your user credentials and timestamp.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};