import React from 'react';
import { useSSE } from '../../hooks/useSSE.js';
import { ProgressBar } from './ProgressBar.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';
import {
  Download,
  FileText,
  Search,
  Bot,
  CheckCircle2,
  CircleAlert,
  Check,
  Loader2,
  Circle,
  RefreshCw,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

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
  icon: LucideIcon;
}

const PIPELINE_STEPS: readonly PipelineStepDef[] = [
  {
    key: 'UPLOADED',
    stepNumber: 1,
    label: 'Upload & Storage',
    contextualDescription: 'Direct byte transfer to encrypted tenant storage with SHA-256 integrity check.',
    activeMessage: 'Storing document in encrypted tenant storage...',
    icon: Download,
  },
  {
    key: 'PARSING_PAGES',
    stepNumber: 2,
    label: 'Document Normalization',
    contextualDescription: 'Parsing PDF text layers, multi-column layouts, and technical tables.',
    activeMessage: 'Normalizing text layers, table structures, and multi-column formatting...',
    icon: FileText,
  },
  {
    key: 'EXTRACTING_COMPLIANCE',
    stepNumber: 3,
    label: 'Requirement Extraction',
    contextualDescription: 'Identifying mandatory criteria, eligibility rules, and statutory clauses.',
    activeMessage: 'Extracting eligibility requirements, statutory clauses, and verbatim citations...',
    icon: Search,
  },
  {
    key: 'VERIFYING_CITATIONS',
    stepNumber: 4,
    label: 'Evidence & Risk Analysis',
    contextualDescription: 'Grounding citations against source text and evaluating against Company Profile.',
    activeMessage: 'Analyzing company evidence against CA UDIN records and evaluating commercial risk...',
    icon: Bot,
  },
  {
    key: 'COMPLETED',
    stepNumber: 5,
    label: 'Bid Readiness Ready',
    contextualDescription: 'Complete compliance matrix generated and ready for human review.',
    activeMessage: 'Preparing bid readiness assessment and workspace sign-off...',
    icon: CheckCircle2,
  },
];

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  bidId,
  documentName = 'Tender Document',
  onComplete,
  onRetry,
}) => {
  const { lastEvent, isConnected, error: sseError, close } = useSSE(`/api/v1/bids/${bidId}/extraction-progress`);

  const currentStepKey = (lastEvent?.step || (lastEvent?.status === 'REVIEW_READY' ? 'COMPLETED' : 'PARSING_PAGES')) as PipelineStageKey;
  const progressPercent = lastEvent?.progress ?? (currentStepKey === 'COMPLETED' ? 100 : 35);
  const isComplete = currentStepKey === 'COMPLETED' || progressPercent === 100;
  const isFailed = !isComplete && (currentStepKey === 'FAILED' || !!sseError);

  const hasCompletedRef = React.useRef(false);

  React.useEffect(() => {
    if (isComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      close();
      onComplete?.();
    } else if (!isComplete) {
      hasCompletedRef.current = false;
    }
  }, [isComplete, onComplete, close]);

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
  const activeStepMeta = PIPELINE_STEPS[activeIndex];

  return (
    <Card padding="lg" style={{ border: '1px solid var(--color-primary-500)', backgroundColor: 'var(--color-surface-card)' }}>
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isFailed ? (
              <CircleAlert size={22} className="text-red-500" />
            ) : isComplete ? (
              <CheckCircle2 size={22} className="text-primary" />
            ) : (
              <Loader2 size={22} className="text-primary animate-spin" />
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-surface-text)', margin: 0 }}>
              {isFailed
                ? 'Document Extraction Failed'
                : isComplete
                  ? 'Tender Intelligence & Compliance Matrix Ready'
                  : 'Live Tender Extraction Pipeline'}
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
                ? 'var(--status-fail-bg)'
                : isComplete
                  ? 'var(--status-pass-bg)'
                  : 'rgba(234, 88, 12, 0.08)',
              color: isFailed
                ? 'var(--status-fail-text)'
                : isComplete
                  ? 'var(--status-pass-text)'
                  : '#ea580c',
              border: `1px solid ${isFailed ? 'var(--status-fail-border)' : isComplete ? 'var(--status-pass-border)' : 'rgba(234, 88, 12, 0.25)'}`,
            }}
          >
            {isFailed
              ? 'Execution Error'
              : isComplete
                ? '100% Completed'
                : isConnected
                  ? 'Live SSE Stream'
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
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary-500)' }}>
              {progressPercent}%
            </span>
          </div>
          <ProgressBar
            progress={progressPercent}
            color={isComplete ? 'var(--color-surface-text)' : 'var(--color-primary-500)'}
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
                  ? 'rgba(234, 88, 12, 0.08)'
                  : isDone
                    ? 'var(--status-pass-bg)'
                    : 'var(--color-surface-bg)',
                border: `1px solid ${
                  isCurrent
                    ? 'var(--color-primary-500)'
                    : isDone
                      ? 'var(--status-pass-border)'
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
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {isDone ? (
                    <Check size={14} className="text-primary" />
                  ) : isCurrent ? (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  ) : (
                    <Circle size={10} className="text-muted-foreground/40" />
                  )}
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
              <Button variant="primary" size="sm" onClick={onRetry} icon={<RefreshCw size={14} />}>
                Retry Extraction
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
            backgroundColor: 'var(--status-pass-bg)',
            border: '1px solid var(--status-pass-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-pass-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} /> Extraction pipeline successfully grounded requirements and citations into your workspace.
          </span>
          <Button variant="primary" size="sm" onClick={onComplete} icon={<ArrowRight size={14} />}>
            Proceed to Requirement Matrix
          </Button>
        </div>
      )}
    </Card>
  );
};
