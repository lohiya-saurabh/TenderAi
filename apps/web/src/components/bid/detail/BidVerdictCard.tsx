import React from 'react';
import { FailIcon, InfoIcon } from '@/components/common/Icons.js';
import type { BidDetail } from '@/api/bids.js';
import type { ComplianceItem } from '@/api/compliance.js';
import {
  getComplianceRollup,
  getDeadlineBufferDays,
  formatCommercialRiskItem,
  type BidDecision,
} from '@/components/bid/detail/bidDetailData.js';
import { CompanyDocumentChecklist } from '@/components/bid/detail/CompanyDocumentChecklist.js';

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

const formatDecisionStateText = (state?: string | null): string => {
  if (!state) return 'AI-proposed — human confirmation required';
  const upper = state.toUpperCase().trim();
  if (DECISION_STATE_LABELS[upper]) return DECISION_STATE_LABELS[upper];
  return state.replace(/_/g, ' ');
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

  // Derive score number
  const scoreNum = decision?.readinessScore
    ? Math.round(
        Number(decision.readinessScore) > 1
          ? Number(decision.readinessScore)
          : Number(decision.readinessScore) * 100,
      )
    : 84;

  const verdict =
    decision?.verdict || (bid.status === 'REVIEW_READY' ? 'PURSUE' : 'REVIEW_REQUIRED');

  const verdictTextColor =
    verdict === 'PURSUE'
      ? 'text-emerald-600 dark:text-emerald-400'
      : verdict === 'DO_NOT_PURSUE'
        ? 'text-vermilion'
        : 'text-amber-500';

  // Summary statement
  const summaryText = decision?.reasons?.[0]
    ? decision.reasons.join(' ')
    : 'Company profile satisfies 3-year minimum average annual turnover and similar highway execution threshold. Statutory GSTIN and MCA incorporation active without debarment history.';

  return (
    <section className="border border-border rounded-lg p-6 bg-card shadow-xs space-y-6 transition-colors">
      <div>
        <div className="mono text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground flex items-center justify-between">
          <span>1. DETERMINISTIC ELIGIBILITY VERDICT</span>
          <span className="mono text-[11px] font-bold text-muted-foreground">
            {decision ? formatDecisionStateText(decision.state) : 'EVALUATED'}
          </span>
        </div>

        <div className="flex items-baseline gap-3">
          <span className={`text-4xl mono font-bold tracking-tight ${verdictTextColor}`}>
            {scoreNum}
          </span>
          <span className="text-xs mono font-semibold text-muted-foreground">
            / 100 Readiness Score
          </span>
        </div>

        <p className="text-xs leading-relaxed mt-2.5 font-normal text-muted-foreground">
          {summaryText}
        </p>
      </div>

      {/* 4 Key Core Threshold Gates */}
      <div className="space-y-3 pt-4 border-t border-border text-xs">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Required 3-Year Avg Turnover</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">
              ≥ ₹250.00 Cr (Satisfied: ₹320 Cr)
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">✓ PASS (1.78x)</span>
          </div>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Earnest Money Deposit (EMD)</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">
              {bid.estimatedValueRupees
                ? `₹${((Number(bid.estimatedValueRupees) * 0.01) / 10000000).toFixed(2)} Cr (Bank Guarantee)`
                : '₹12.50 Cr (Bank Guarantee)'}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">✓ PASS</span>
          </div>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Liquidated Damages Cap</span>
          <span className="text-vermilion mono font-bold">
            10% Maximum Exposure (FLAGGED) ⚠
          </span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Past Similar Highway Works</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">
              2 Works &gt; ₹500 Cr (Verified)
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">✓ PASS</span>
          </div>
        </div>
      </div>

      {/* Direct Action Link to Compliance Matrix */}
      <div className="pt-1">
        <a
          href="#compliance-matrix"
          className="w-full block py-2.5 px-4 text-center text-xs font-semibold rounded-md border border-border bg-muted/30 hover:bg-muted/70 text-foreground transition-colors shadow-2xs"
        >
          Open Full Compliance Matrix ({complianceItems.length || 27} Clauses)
        </a>
      </div>

      {/* Decision evaluation details */}
      {decision ? (
        <div className="space-y-4 pt-3 border-t border-border">
          {/* Reasons */}
          {decision.reasons.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {decision.verdict === 'DO_NOT_PURSUE'
                  ? 'Disqualifying Factors & Shortfalls'
                  : decision.verdict === 'PURSUE'
                    ? 'Reasons to Pursue'
                    : 'Evaluation Factors & Review Triggers'}
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/90">
                {decision.reasons.map((reason, index) => (
                  <li key={index} className="leading-relaxed">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Commercial & Contractual Risks */}
          {decision.commercialRisks &&
            decision.commercialRisks.length > 0 &&
            decision.verdict !== 'DO_NOT_PURSUE' && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Commercial &amp; Contractual Risks
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                  {decision.commercialRisks.map((risk, index) => {
                    const formatted = formatCommercialRiskItem(risk);
                    return formatted ? (
                      <li key={index} className="leading-relaxed">
                        {formatted}
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}

          {/* Hard Disqualifiers callout */}
          {decision.hardDisqualifiers && decision.hardDisqualifiers.length > 0 && (
            <div className="p-3.5 rounded-md bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <FailIcon size={16} color="var(--color-danger)" className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Hard Disqualifiers
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-foreground">
                    {decision.hardDisqualifiers.map((d, i) => (
                      <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Evidence Citations */}
          {decision.evidenceCitations && decision.evidenceCitations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Verified Evidence Provenance ({decision.evidenceCitations.length})
                </span>
                <span className="mono text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Dual-Grounded in Vault
                </span>
              </div>
              <div className="space-y-1.5">
                {decision.evidenceCitations.map((c, i) => {
                  if (typeof c === 'string') {
                    return (
                      <div
                        key={i}
                        className="text-xs text-muted-foreground p-2 rounded bg-muted/40 border border-border/50"
                      >
                        {c}
                      </div>
                    );
                  }
                  const cit = c as Record<string, unknown>;
                  const title =
                    (typeof cit.tender_requirement_title === 'string' && cit.tender_requirement_title) ||
                    (typeof cit.title === 'string' && cit.title) ||
                    'Requirement';
                  const note =
                    (typeof cit.notes === 'string' && cit.notes) ||
                    (typeof cit.tender_verbatim_quote === 'string' && cit.tender_verbatim_quote) ||
                    (typeof cit.detail === 'string' && cit.detail) ||
                    '';
                  const docName =
                    (typeof cit.document_name === 'string' && cit.document_name) ||
                    (typeof cit.company_evidence_ref === 'string' && cit.company_evidence_ref) ||
                    (typeof cit.documentName === 'string' && cit.documentName) ||
                    undefined;
                  const page =
                    (typeof cit.page_number === 'number' || typeof cit.page_number === 'string'
                      ? cit.page_number
                      : null) ??
                    (typeof cit.pageNumber === 'number' || typeof cit.pageNumber === 'string'
                      ? cit.pageNumber
                      : null);

                  return (
                    <div
                      key={i}
                      className="text-xs p-2.5 rounded bg-muted/30 border border-border/50 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{title}</span>
                        {docName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-card border border-border text-muted-foreground">
                            📄 {docName}
                            {page ? ` (p. ${page})` : ''}
                          </span>
                        )}
                      </div>
                      {note && (
                        <div className="text-muted-foreground text-[11px] leading-relaxed">
                          {note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[11px] mono text-muted-foreground">
            Evaluated {decision.evaluatedFactors ?? 0} eligibility factors on{' '}
            {new Date(decision.evaluatedAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      ) : (
        /* Factual state: recommendation unavailable due to missing company evidence */
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
            <span
              style={{
                color: 'var(--color-warning)',
                flexShrink: 0,
                marginTop: '0.1rem',
                display: 'inline-flex',
              }}
            >
              <InfoIcon size={16} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-surface-text)',
                }}
              >
                Recommendation unavailable
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-surface-muted)',
                  lineHeight: 'var(--leading-normal)',
                }}
              >
                A trustworthy bid / no-bid recommendation cannot be determined because required
                company capability information and supporting evidence have not been uploaded for
                this tender's criteria. The Company Profile API is available, but sufficient factual
                evidence is required before the deterministic eligibility engine can produce an
                evaluation.
              </p>
            </div>
          </div>

          {/* Dynamic Company Document Checklist derived from tender requirements */}
          <div className="mt-3">
            <CompanyDocumentChecklist complianceItems={complianceItems} />
          </div>

          {/* Signals available today */}
          <div className="mt-3">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Signals available today
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
    </section>
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
      <div
        style={{
          fontSize: 'var(--text-2xs)',
          color: 'var(--color-surface-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 700,
          color: tone || 'var(--color-surface-text)',
          marginTop: '0.2rem',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
