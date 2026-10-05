import React, { useEffect } from 'react';
import { CloseIcon } from './Icons.js';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  position?: 'right' | 'left';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = '480px',
  position = 'right',
}) => {
  const drawerId = React.useId();
  const titleId = `drawer-title-${drawerId}`;
  const descId = `drawer-desc-${drawerId}`;

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
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: position === 'right' ? 'flex-end' : 'flex-start',
        zIndex: 'var(--z-index-drawer)' as unknown as number,
      }}
      onClick={onClose}
    >
      <div
        className="slide-in-right"
        style={{
          backgroundColor: 'var(--color-surface-card)',
          borderLeft: position === 'right' ? '1px solid var(--color-surface-border)' : 'none',
          borderRight: position === 'left' ? '1px solid var(--color-surface-border)' : 'none',
          width: '100%',
          maxWidth: width,
          height: '100%',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            backgroundColor: 'var(--color-surface-card)',
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
            aria-label="Close drawer"
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

        {/* Content */}
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
