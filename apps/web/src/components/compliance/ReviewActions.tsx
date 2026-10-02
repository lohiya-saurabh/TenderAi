import React, { useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';
import { Input } from '../common/Input.js';

export interface ReviewActionsProps {
  currentStatus: 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';
  onReview: (status: 'READY' | 'FLAGGED' | 'WAIVED', notes?: string) => Promise<void>;
  isLoading?: boolean;
}

export const ReviewActions: React.FC<ReviewActionsProps> = ({
  currentStatus,
  onReview,
  isLoading = false,
}) => {
  const { hasPermission } = useAuth();
  const canReview = hasPermission(PERMISSIONS.COMPLIANCE_REVIEW);

  const [modalAction, setModalAction] = useState<'READY' | 'FLAGGED' | 'WAIVED' | null>(null);
  const [notes, setNotes] = useState<string>('');

  if (!canReview) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-subtle)', fontStyle: 'italic' }}>
        Read-only (Review requires <code>compliance:review</code> permission)
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!modalAction) return;
    await onReview(modalAction, notes.trim() || undefined);
    setModalAction(null);
    setNotes('');
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        variant="success"
        size="sm"
        disabled={isLoading || currentStatus === 'READY'}
        onClick={() => setModalAction('READY')}
      >
        ✓ Approve (Ready)
      </Button>

      <Button
        variant="danger"
        size="sm"
        disabled={isLoading || currentStatus === 'FLAGGED'}
        onClick={() => setModalAction('FLAGGED')}
      >
        🚩 Flag Issue
      </Button>

      <Button
        variant="secondary"
        size="sm"
        disabled={isLoading || currentStatus === 'WAIVED'}
        onClick={() => setModalAction('WAIVED')}
      >
        Waive
      </Button>

      <Modal
        isOpen={modalAction !== null}
        onClose={() => setModalAction(null)}
        title={`Confirm Review: Mark as ${modalAction}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalAction(null)}>
              Cancel
            </Button>
            <Button
              variant={modalAction === 'FLAGGED' ? 'danger' : modalAction === 'READY' ? 'success' : 'primary'}
              onClick={handleConfirm}
              isLoading={isLoading}
            >
              Confirm Update
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-surface-text)' }}>
            Are you sure you want to update the status to <strong>{modalAction}</strong>?
          </p>
          <Input
            label="Reviewer Notes / Justification (Optional)"
            placeholder="e.g. Verified against NIT clause 4.2 page 18"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
