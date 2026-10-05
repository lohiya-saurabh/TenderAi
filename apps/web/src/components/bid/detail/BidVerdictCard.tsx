import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../common/Card.js';
import { Badge } from '../../common/Badge.js';
import {
  PassIcon,
  FailIcon,
  ReviewRequiredIcon,
  InfoIcon,
} from '../../common/Icons.js';
import type { BidDetail } from '../../../api/bids.js';
import type { ComplianceItem } from '../../../api/compliance.js';
import {
  getComplianceRollup,
  getDeadlineBufferDays,
  type BidDecision,
  type BidRecommendation,
} from './bidDetailData.js';

export interface BidVerdictCardProps {
  bid: BidDetail;
  complianceItems: ComplianceItem[];
  /**
   * Mapped frontend decision from GET /api/v1/bids/:id/bid-decision.
   * Null when the tender has not been evaluated yet (404).
   */
  decision: BidDecision | null;
}

const DECISION_STATE_LABELS: Record<string, string> = {
  AI_PROPOSED: 'AI-proposed — human confirmation required',
  ai_proposed: 'AI-proposed — human confirmation required',
  UNDER_REVIEW: 'Under human review',
  under_review: 'Under human review',
  CONFIRMED: 'Confirmed by human review',
  confirmed: 'Confirmed by human review',
  OVERRIDDEN: 'Overridden by human review — original verdict preserved',
  overridden: 'Overridden by human review — original verdict preserved',
  PENDING_REVIEW: 'Pending human review',
  pending_review: 'Pending human review',
  DRAFT: 'Draft assessment',
  draft: 'Draft assessment',
};

const formatFitScorePercent = (score?: number | null): string => {
  if (score === null || score === undefined || Number.isNaN(score)) return '0%';
  const num = Number(score);
  // Normalize: if score is > 1 (e.g. 86.5), it's already a 0..100 percentage; if <= 1 (e.g. 0.865), scale by 100
  const pct = num > 1 ? num : num * 100;
  return `${Math.round(pct)}%`;
};

const formatDecisionStateText = (state?: string | null): string => {
  if (!state) return 'AI-proposed — human confirmation required';
  const upper = state.toUpperCase().trim();
  if (DECISION_STATE_LABELS[upper]) return DECISION_STATE_LABELS[upper];
  return state.replace(/_/g, ' ');
};

const verdictColors: Record<BidRecommendation, { border: string; bg: string; color: string; icon: React.ReactNode }> = {
  PURSUE: {
    border: 'var(--color-success-border)',
    bg: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    icon: <PassIcon size={20} />,
  },
  DO_NOT_PURSUE: {
    border: 'var(--color-danger-border)',
    bg: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
    icon: <FailIcon size={20} />,
  },
  REVIEW_REQUIRED: {
    border: 'var(--color-warning-border)',
    bg: 'var(--color-warning-bg)',
    color: 'var(--color-warning)',
    icon: <ReviewRequiredIcon size={20} />,
  },
};

/**
 * "Should I bid on this tender?"
 *
 * The decision framework is PURSUE / DO_NOT_PURSUE / REVIEW_REQUIRED
 * with supporting reasons — never an unexplained score. The verdict is
 * produced by the deterministic eligibility engine evaluating the
 * Company Capability Profile against this tender.
 */
export const BidVerdictCard: React.FC<BidVerdictCardProps> = ({
  bid,
  complianceItems,
  decision,
}) => {
  const rollup = getComplianceRollup(complianceItems, bid);
  const deadlineBufferDays = getDeadlineBufferDays(bid, Date.now());

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          decision ? (
            <Badge
              variant={
                decision.verdict === 'PURSUE'
                  ? 'success'
                  : decision.verdict === 'DO_NOT_PURSUE'
                    ? 'danger'
                    : 'warning'
              }
              size="sm"
              dot
            >
              {(decision.verdict || 'REVIEW_REQUIRED').replace(/_/g, ' ')}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" dot>
              Not evaluated
            </Badge>
          )
        }
      >
        <CardTitle as="h3">Should I Bid on This Tender?</CardTitle>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Bid / no-bid recommendation with supporting reasons — no unexplained scores
        </p>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Verdict display */}
          {decision ? (() => {
            const v: BidRecommendation =
              decision.verdict && verdictColors[decision.verdict]
                ? decision.verdict
                : 'REVIEW_REQUIRED';
            return (
              <>
                {/* Primary verdict banner */}
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${verdictColors[v].border}`,
                    backgroundColor: verdictColors[v].bg,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ color: verdictColors[v].color, flexShrink: 0 }}>
                      {verdictColors[v].icon}
                    </span>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: verdictColors[v].color }}>
                        {v.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', marginTop: '0.25rem' }}>
                        Fit score: <strong>{formatFitScorePercent(decision.readinessScore)}</strong>{' '}
                        • {formatDecisionStateText(decision.state)}
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)', textAlign: 'right', minWidth: '160px' }}>
                      Evaluated {new Date(decision.evaluatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Reasons */}
                {decision.reasons.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Reasons
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {decision.reasons.map((reason, index) => (
                        <li key={index} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', lineHeight: 'var(--leading-normal)' }}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hard disqualifiers callout */}
                {decision.hardDisqualifiers && decision.hardDisqualifiers.length > 0 && (
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-danger-bg)',
                      border: '1px solid var(--color-danger-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <FailIcon size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Hard Disqualifiers
                        </div>
                        <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)' }}>
                          {decision.hardDisqualifiers.map((d, i) => (
                            <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence citations */}
                {decision.evidenceCitations && decision.evidenceCitations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Evidence Citations
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {decision.evidenceCitations.map((c, i) => (
                        <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', lineHeight: 'var(--leading-normal)' }}>
                          {typeof c === 'string' ? c : JSON.stringify(c)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Metadata footer */}
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)' }}>
                  Evaluated {decision.evaluatedFactors ?? 0} eligibility factors on {new Date(decision.evaluatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </>
            );
          })() : (
            /* Honest current state: no recommendation without the engine */
            <>
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
                  <InfoIcon size={16} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                    No recommendation yet
                  </span>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', lineHeight: 'var(--leading-normal)' }}>
                    The bid / no-bid verdict is computed by the eligibility engine evaluating your
                    Company Capability Profile against this tender's statutory, financial, technical,
                    and experience criteria. Neither the engine nor the Company Profile API exists
                    yet, so no verdict is shown rather than a fabricated one.
                  </p>
                </div>
              </div>

              {/* Real input signals the future engine will consume */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                  Signals available today (inputs, not a verdict)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 'var(--space-3)',
                  }}
                >
                  <Signal label="Requirements extracted" value={String(rollup.total)} />
                  <Signal
                    label="Flagged for review"
                    value={String(rollup.flagged)}
                    tone={rollup.flagged > 0 ? 'var(--color-danger)' : undefined}
                  />
                  <Signal
                    label="Awaiting human review"
                    value={String(rollup.reviewNeeded)}
                    tone={rollup.reviewNeeded > 0 ? 'var(--color-warning)' : undefined}
                  />
                  <Signal
                    label="Deadline buffer"
                    value={deadlineBufferDays === null ? '—' : `${deadlineBufferDays} days`}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

function Signal({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-surface-card-subtle)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-surface-border)',
      }}
    >
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: tone || 'var(--color-surface-text)', marginTop: '0.2rem', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}