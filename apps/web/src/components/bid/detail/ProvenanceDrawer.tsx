import React from 'react';
import type { ComplianceItem } from '../../../api/compliance.js';
import { CloseIcon, MissingIcon } from '../../common/Icons.js';

export interface ProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Requirement whose grounded provenance is shown */
  item: ComplianceItem | null;
}

/**
 * Evidence / citation inspector.
 *
 * Shows the REAL tender-side grounding for a requirement: the
 * verbatim clause quote extracted from the uploaded tender
 * document, with document / page / clause anchors and the
 * extraction confidence score.
 *
 * Company-side evidence matching ("which company document
 * satisfies this clause?") has no backend yet — the Evidence
 * Vault and matching engine are documented as missing APIs,
 * so the drawer states that gap explicitly instead of showing
 * fabricated company documents.
 */
export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  if (!isOpen || !item) return null;

  const provenance = item.provenance;
  const confidencePercent = Math.round((provenance?.confidenceScore || 0) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Requirement citation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-index-drawer, 60)' as unknown as number,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '100%',
          backgroundColor: 'var(--color-surface-card)',
          borderLeft: '1px solid var(--color-surface-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderBottom: '1px solid var(--color-surface-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--color-surface-card)',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                color: 'var(--color-primary-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Requirement Citation
            </div>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' as unknown as number, color: 'var(--color-surface-text)', margin: 0 }}>
              {item.requirement}
            </h3>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
              {item.category} requirement
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close citation panel"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-surface-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Grounded verbatim quote */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Verbatim Tender Clause
            </div>
            <div
              style={{
                backgroundColor: 'var(--color-surface-bg)',
                borderLeft: '3px solid var(--color-primary-500)',
                padding: '0.75rem 1rem',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                fontStyle: 'italic',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-surface-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              "{provenance?.verbatimQuote || item.description}"
            </div>
          </div>

          {/* Source anchors */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-border)',
            }}
          >
            <Anchor label="Source document" value={provenance?.documentName || 'Unknown'} />
            <Anchor label="Page" value={provenance ? String(provenance.pageNumber) : '—'} />
            <Anchor label="Clause / Section" value={provenance?.sectionOrClause || '—'} />
            <Anchor
              label="Extraction confidence"
              value={`${confidencePercent}%`}
            />
          </div>

          {/* Company-side evidence gap — honest, documented */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-surface-border)',
            }}
          >
            <span style={{ color: 'var(--color-primary-400)', flexShrink: 0, marginTop: '0.1rem', display: 'inline-flex' }}>
              <MissingIcon size={16} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                Company evidence matching not yet available
              </span>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', lineHeight: 'var(--leading-normal)' }}>
                "Which company document satisfies this clause?" requires the
                Evidence Vault and the evidence-matching engine against the
                Company Capability Profile. Neither has a backend API yet
                (documented as missing endpoints), so no company-side proof
                is shown.
              </p>
            </div>
          </div>

          {/* Requirement detail */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Requirement Detail
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-surface-muted)', lineHeight: 'var(--leading-normal)' }}>
              {item.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}
