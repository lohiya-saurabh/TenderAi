import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal.js';
import { Button } from '@/components/common/Button.js';
import { CheckCircle2 } from 'lucide-react';

export interface AddCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCapability?: (capability: { title: string; udin: string; docName: string }) => void;
}

export const AddCapabilityModal: React.FC<AddCapabilityModalProps> = ({
  isOpen,
  onClose,
  onAddCapability,
}) => {
  const [title, setTitle] = useState('');
  const [docName, setDocName] = useState('');
  const [udin, setUdin] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddCapability) {
      onAddCapability({ title, udin, docName });
    }
    setAddSuccess(true);
    setTimeout(() => {
      setAddSuccess(false);
      setTitle('');
      setDocName('');
      setUdin('');
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Reusable Corporate Capability"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save Capability
          </Button>
        </>
      }
    >
      {addSuccess ? (
        <div
          style={{
            color: 'var(--color-success)',
            textAlign: 'center',
            padding: '1.5rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={18} /> Capability added to persistent dossier!
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              Capability Title / Description *
            </label>
            <input
              type="text"
              placeholder="e.g. FY 2024-25 Turnover Statement or ISO 27001 Certificate"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-surface-text)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              CA UDIN / Certificate Number (If applicable)
            </label>
            <input
              type="text"
              placeholder="e.g. 24098123AAAAA1234 or BVQI-IND-9001"
              value={udin}
              onChange={(e) => setUdin(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-surface-text)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                display: 'block',
                marginBottom: '0.35rem',
              }}
            >
              Evidence Document Name / Upload *
            </label>
            <input
              type="text"
              placeholder="e.g. Audited_Balance_Sheet_2025.pdf"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-surface-text)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
          </div>
        </form>
      )}
    </Modal>
  );
};
