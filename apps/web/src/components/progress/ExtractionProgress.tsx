import React from 'react';
import { useSSE } from '../../hooks/useSSE.js';
import { ProgressBar } from './ProgressBar.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';

export interface ExtractionProgressProps {
  bidId: string;
  documentName?: string;
  onComplete?: () => void;
  onRetry?: () => void;
}

export type PipelineStageKey =
  | 'UPLOADED'
  | 'PARSING_PAGES'
  | 'EXTRACTING_COMPLIANCE'
  | 'VERIFYING_CITATIONS'
  | 'ANALYZING_EVIDENCE'
  | 'COMPLETED'
  | 'FAILED';

export interface PipelineStepDef {
  key: PipelineStageKey;
  stepNumber: number;
  label: string;
  contextualDescription: string;
  activeMessage: string;
  icon: string;
}

const PIPELINE_STEPS: readonly PipelineStepDef[] = [
  {
    key: 'UPLOADED',
    stepNumber: 1,
    label: 'Upload & Storage',
    contextualDescription: 'Direct byte transfer to encrypted tenant storage with SHA-256 integrity check.',
    activeMessage: 'Storing document in encrypted tenant storage...',
    icon: '📥',
  },
  {
    key: 'PARSING_PAGES',
    stepNumber: 2,
    label: 'Document Normalization',
    contextualDescription: 'Parsing PDF text layers, multi-column layouts, and technical tables.',
    activeMessage: 'Normalizing text layers, table structures, and multi-column formatting...',
    icon: '📄',
  },
  {
    key: 'EXTRACTING_COMPLIANCE',
    stepNumber: 3,
    label: 'Requirement Extraction',
    contextualDescription: 'Identifying mandatory criteria, eligibility rules, and statutory clauses.',
    activeMessage: 'Extracting eligibility requirements, statutory clauses, and verbatim citations...',
    icon: '🔍',
  },
  {
    key: 'VERIFYING_CITATIONS',
    stepNumber: 4,
    label: 'Evidence & Risk Analysis',
    contextualDescription: 'Grounding citations against source text and evaluating against Company Profile.',
    activeMessage: 'Analyzing company evidence against CA UDIN records and evaluating commercial risk...',
    icon: '🧠',
  },
  {
    key: 'COMPLETED',
    stepNumber: 5,
    label: 'Bid Readiness Ready',
    contextualDescription: 'Complete compliance matrix generated and ready for human review.',
    activeMessage: 'Preparing bid readiness assessment and workspace sign-off...',
    icon: '✅',
  },
];

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  bidId,
  documentName = 'Tender Document',
  onComplete,
  onRetry,
}) => {
  const { lastEvent, isConnected, error: sseError } = useSSE(`/api/v1/bids/${bidId}/extraction-progress`);

  const currentStepKey = (lastEvent?.step || (lastEvent?.status === 'REVIEW_READY' ? 'COMPLETED' : 'PARSING_PAGES')) as PipelineStageKey;
  const progressPercent = lastEvent?.progress ?? (currentStepKey === 'COMPLETED' ? 100 : 35);
  const isFailed = currentStepKey === 'FAILED' || !!sseError;
  const isComplete = currentStepKey === 'COMPLETED' || progressPercent === 100;

  React.useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  // Determine active step index
  const getCurrentStepIndex = (): number => {
    switch (currentStepKey) {
      case 'UPLOADED':
        return 0;
      case 'PARSING_PAGES':
        return 1;
      case 'EXTRACTING_COMPLIANCE':
        return 2;
      case 'VERIFYING_CITATIONS':
      case 'ANALYZING_EVIDENCE':
        return 3;
      case 'COMPLETED':
        return 4;
      default:
        return 1;
    }
  };

  const activeIndex = getCurrentStepIndex();
  const activeStepMeta = PIPELINE_STEPS[Math.min(activeIndex, PIPELINE_STEPS.length - 1)];

  return (
    <Card
      padding="lg"
      style={{
        border: `1px solid ${isFailed ? 'var(--color-danger)' : isComplete ? 'var(--color-success)' : 'var(--color-primary-500)'}`,
        backgroundColor: 'var(--color-surface-card)',
        margin: '1.25rem 0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span
            style={{
              fontSize: '1.25rem',
              animation: isComplete || isFailed ? 'none' : 'pulse 1.5s infinite',
            }}
          >
            {isFailed ? '❌' : isComplete ? '🎉' : '⚡'}
          </span>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-surface-text)', margin: 0 }}>
              {isFailed
                ? 'Document Extraction Failed'
                : isComplete
                  ? 'Tender Intelligence & Compliance Matrix Ready'
                  : 'Live Tender Processing Pipeline'}
            </h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              Document: <strong>{documentName}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: 'var(--text-2xs)',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isFailed
                ? 'rgba(239, 68, 68, 0.15)'
                : isComplete
                  ? 'rgba(16, 185, 129, 0.15)'
                  : isConnected
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
              color: isFailed
                ? 'var(--color-danger)'
                : isComplete
                  ? 'var(--color-success)'
                  : isConnected
                    ? 'var(--color-primary-300)'
                    : 'var(--color-warning)',
              border: `1px solid ${isFailed ? 'var(--color-danger)' : isComplete ? 'var(--color-success)' : 'var(--color-surface-border)'}`,
            }}
          >
            {isFailed
              ? '● Execution Error'
              : isComplete
                ? '● 100% Completed'
                : isConnected
                  ? '● Live SSE Stream'
                  : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Progress Bar & Live Contextual Message */}
      {!isFailed && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
              {lastEvent?.message || activeStepMeta?.activeMessage || 'Processing document...'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary-300)' }}>
              {progressPercent}%
            </span>
          </div>
          <ProgressBar
            progress={progressPercent}
            color={isComplete ? 'var(--color-success)' : 'var(--color-primary-500)'}
            height="8px"
          />
        </div>
      )}

      {/* 5-Stage Stepper Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          marginTop: '0.5rem',
        }}
      >
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone = isComplete || activeIndex > idx;
          const isCurrent = !isComplete && !isFailed && activeIndex === idx;

          return (
            <div
              key={step.key}
              style={{
                backgroundColor: isCurrent
                  ? 'rgba(99, 102, 241, 0.1)'
                  : isDone
                    ? 'rgba(16, 185, 129, 0.05)'
                    : 'var(--color-surface-bg)',
                border: `1px solid ${
                  isCurrent
                    ? 'var(--color-primary-500)'
                    : isDone
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'var(--color-surface-border)'
                }`,
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-surface-text)' }}>
                  {step.stepNumber}. {step.label}
                </span>
                <span style={{ fontSize: 'var(--text-xs)' }}>
                  {isDone ? '✓' : isCurrent ? '⏳' : '⚪'}
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--text-2xs)',
                  color: isCurrent
                    ? 'var(--color-primary-300)'
                    : isDone
                      ? 'var(--color-success)'
                      : 'var(--color-surface-muted)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {step.contextualDescription}
              </p>
            </div>
          );
        })}
      </div>

      {/* Actionable Error Card */}
      {isFailed && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-danger)', margin: '0 0 0.35rem' }}>
              What went wrong?
            </h4>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', margin: 0, lineHeight: 1.5 }}>
              {sseError || 'The extraction pipeline encountered a timeout while processing multi-column tables and complex formatting.'}
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface-card)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--color-success)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-text)',
            }}
          >
            <strong>Data Safety Guarantee:</strong> Your uploaded PDF is securely preserved in encrypted tenant storage. Existing bid details and previously verified documents are unaffected.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase' }}>
              Recommended Next Steps:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm" onClick={onRetry}>
                🔄 Retry Extraction
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Re-upload Clean PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completion CTA */}
      {isComplete && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
            ✓ Extraction pipeline successfully grounded requirements and citations into your workspace.
          </span>
          <Button variant="success" size="sm" onClick={onComplete}>
            Proceed to Requirement Matrix →
          </Button>
        </div>
      )}
    </Card>
  );
};
