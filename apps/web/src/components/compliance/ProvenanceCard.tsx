import React from 'react';
import { MapPin } from 'lucide-react';
import type { Provenance } from '../../api/compliance.js';

export interface ProvenanceCardProps {
  provenance: Provenance;
}

export const ProvenanceCard: React.FC<ProvenanceCardProps> = ({ provenance }) => {
  const confidencePercent = Math.round((provenance.confidenceScore || 0) * 100);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-surface-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-surface-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={16} className="text-primary shrink-0" /> Source Citation & Grounding Proof
        </h4>
        <div
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: confidencePercent > 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: confidencePercent > 80 ? 'var(--color-success)' : 'var(--color-warning)',
            fontWeight: 600,
          }}
        >
          {confidencePercent}% AI Grounding Confidence
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--color-surface-muted)', marginBottom: '0.75rem' }}>
        <div>
          <strong style={{ color: 'var(--color-surface-text)' }}>Page:</strong> {provenance.pageNumber}
        </div>
        {provenance.sectionOrClause && (
          <div>
            <strong style={{ color: 'var(--color-surface-text)' }}>Clause / Section:</strong> {provenance.sectionOrClause}
          </div>
        )}
        {provenance.documentName && (
          <div>
            <strong style={{ color: 'var(--color-surface-text)' }}>Document:</strong> {provenance.documentName}
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface-bg)',
          borderLeft: '3px solid var(--color-primary-500)',
          padding: '0.75rem 1rem',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          fontStyle: 'italic',
          fontSize: '0.85rem',
          color: 'var(--color-surface-text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        "{provenance.verbatimQuote}"
      </div>
    </div>
  );
};
