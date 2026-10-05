import React, { useEffect } from 'react';
import { CloseIcon } from './Icons.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth,
  size = 'md',
}) => {
  const modalId = React.useId();
  const titleId = `modal-title-${modalId}`;
  const descId = `modal-desc-${modalId}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getMaxWidth = (): string => {
    if (maxWidth) return maxWidth;
    switch (size) {
      case 'sm':
        return '400px';
      case 'lg':
        return '720px';
      case 'xl':
        return '900px';
      case 'full':
        return '95vw';
      case 'md':
      default:
        return '550px';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-index-modal, 70)' as unknown as number,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="scale-in"
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: getMaxWidth(),
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-surface-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <h3
              id={titleId}
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)' as unknown as number,
                color: 'var(--color-surface-text)',
                lineHeight: 'var(--leading-tight)',
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                id={descId}
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-surface-muted)',
                  marginTop: '0.25rem',
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-surface-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color var(--transition-fast)',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            color: 'var(--color-surface-text)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-surface-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'var(--color-surface-card-subtle)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
