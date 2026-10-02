import React from 'react';
import { useSSE } from '../../hooks/useSSE.js';
import { ProgressBar } from './ProgressBar.js';

export interface ExtractionProgressProps {
  bidId: string;
  onComplete?: () => void;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  bidId,
  onComplete,
}) => {
  const { lastEvent, isConnected, error } = useSSE(`/api/v1/bids/${bidId}/progress`);

  React.useEffect(() => {
    if (lastEvent?.step === 'COMPLETED' || lastEvent?.status === 'REVIEW_READY') {
      onComplete?.();
    }
  }, [lastEvent, onComplete]);

  const steps = [
    { key: 'PARSING_PAGES', label: 'PDF Text & Page Extraction' },
    { key: 'EXTRACTING_COMPLIANCE', label: 'AI Compliance Analysis' },
    { key: 'VERIFYING_CITATIONS', label: 'Grounding & Provenance Verification' },
    { key: 'COMPLETED', label: 'Compliance Checklist Ready' },
  ];

  const currentStep = lastEvent?.step || 'PARSING_PAGES';
  const progress = lastEvent?.progress ?? 25;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: '1px solid var(--color-primary-500)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        margin: '1.5rem 0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="pulse" style={{ color: 'var(--color-primary-500)', fontSize: '1.25rem' }}>
            ⚡
          </span>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-surface-text)' }}>
            AI Compliance Pipeline in Progress
          </h4>
        </div>
        <div style={{ fontSize: '0.8rem', color: isConnected ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {isConnected ? '● Connected (Live)' : 'Connecting...'}
        </div>
      </div>

      <ProgressBar progress={progress} showLabel />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
      >
        {steps.map((s, idx) => {
          const isDone = progress > (idx + 1) * 25 || currentStep === 'COMPLETED';
          const isCurrent = currentStep === s.key;

          return (
            <div
              key={s.key}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isCurrent
                  ? 'rgba(99, 102, 241, 0.12)'
                  : isDone
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'var(--color-surface-bg)',
                border: `1px solid ${
                  isCurrent
                    ? 'var(--color-primary-500)'
                    : isDone
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'var(--color-surface-border)'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem' }}>
                  {isDone ? '✅' : isCurrent ? '⏳' : '⚪'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isCurrent
                      ? 'var(--color-primary-100)'
                      : isDone
                      ? 'var(--color-success)'
                      : 'var(--color-surface-muted)',
                  }}
                >
                  Step {idx + 1}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-surface-text)' }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-warning)' }}>
          {error}
        </div>
      )}
    </div>
  );
};
