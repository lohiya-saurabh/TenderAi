import React from 'react';
import { useSSE } from '@/hooks/useSSE.js';
import { Progress } from '@/components/ui/progress.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/common/Button.js';
import { Card } from '@/components/common/Card.js';
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
    contextualDescription:
      'Direct byte transfer to encrypted tenant storage with SHA-256 integrity check.',
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
    contextualDescription:
      'Identifying mandatory criteria, eligibility rules, and statutory clauses.',
    activeMessage:
      'Extracting eligibility requirements, statutory clauses, and verbatim citations...',
    icon: Search,
  },
  {
    key: 'VERIFYING_CITATIONS',
    stepNumber: 4,
    label: 'Evidence & Risk Analysis',
    contextualDescription:
      'Grounding citations against source text and evaluating against Company Profile.',
    activeMessage:
      'Analyzing company evidence against CA UDIN records and evaluating commercial risk...',
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
  const {
    lastEvent,
    isConnected,
    error: sseError,
    close,
  } = useSSE(`/api/v1/bids/${bidId}/extraction-progress`);

  const currentStepKey = (lastEvent?.step ||
    (lastEvent?.status === 'REVIEW_READY' ? 'COMPLETED' : 'PARSING_PAGES')) as PipelineStageKey;
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
    <Card padding="lg" className="border-primary">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {isFailed ? (
            <CircleAlert size={22} className="shrink-0 text-destructive" />
          ) : isComplete ? (
            <CheckCircle2 size={22} className="shrink-0 text-success" />
          ) : (
            <Loader2 size={22} className="shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {isFailed
                ? 'Extraction failed'
                : isComplete
                  ? 'Requirements extracted'
                  : 'Extracting requirements'}
            </h3>
            <p className="break-words text-xs text-muted-foreground">
              Document: <span className="font-medium text-foreground">{documentName}</span>
            </p>
          </div>
        </div>
        <span
          className={cn(
            'rounded border px-2 py-0.5 text-2xs font-semibold',
            isFailed
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : isComplete
                ? 'border-success/30 bg-success/15 text-success'
                : 'border-primary/25 bg-primary/10 text-primary',
          )}
        >
          {isFailed ? 'Failed' : isComplete ? 'Complete' : isConnected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      {!isFailed && (
        <div className="mb-5">
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="font-medium text-foreground">
              {lastEvent?.message || activeStepMeta?.activeMessage || 'Processing document…'}
            </span>
            <span className="font-semibold tabular-nums text-primary">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            aria-label="Extraction progress"
            indicatorColor={isComplete ? 'bg-success' : 'bg-primary'}
          />
        </div>
      )}

      <ol className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone = isComplete || activeIndex > idx;
          const isCurrent = !isComplete && !isFailed && activeIndex === idx;

          return (
            <li
              key={step.key}
              className={cn(
                'flex flex-col gap-1 rounded-md border px-3.5 py-3 transition-colors',
                isCurrent
                  ? 'border-primary bg-primary/10'
                  : isDone
                    ? 'border-success/30 bg-success/10'
                    : 'border-border bg-background',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {step.stepNumber}. {step.label}
                </span>
                {isDone ? (
                  <Check size={14} className="shrink-0 text-success" aria-label="Done" />
                ) : isCurrent ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle size={10} className="shrink-0 text-muted-foreground/40" />
                )}
              </div>
              <p className="text-2xs leading-snug text-muted-foreground">
                {step.contextualDescription}
              </p>
            </li>
          );
        })}
      </ol>

      {isFailed && (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-5">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-destructive">What went wrong</h4>
            <p className="text-xs leading-relaxed text-foreground">
              {sseError || 'The extraction did not finish. No reason was reported.'}
            </p>
          </div>
          <p className="text-xs text-foreground">
            Your uploaded PDF and the bid's existing details are kept.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onRetry} icon={<RefreshCw size={14} />}>
              Retry extraction
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Upload again
            </Button>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <CheckCircle2 size={16} className="shrink-0 text-success" />
            Requirements and their source pages are ready to review.
          </span>
          <Button variant="primary" size="sm" onClick={onComplete} icon={<ArrowRight size={14} />}>
            Review clauses
          </Button>
        </div>
      )}
    </Card>
  );
};
