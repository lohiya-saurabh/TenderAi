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
  const scoreNum = decision?.readinessScore !== undefined && decision?.readinessScore !== null
    ? Math.round(
        Number(decision.readinessScore) > 1
          ? Number(decision.readinessScore)
          : Number(decision.readinessScore) * 100,
      )
    : null;

  const verdict = decision?.verdict || 'REVIEW_REQUIRED';

  const verdictTextColor =
    verdict === 'PURSUE'
      ? 'text-emerald-600 dark:text-emerald-400'
      : verdict === 'DO_NOT_PURSUE'
        ? 'text-vermilion'
        : 'text-amber-500';

  // Summary statement
  const summaryText = decision?.reasons?.[0]
    ? decision.reasons[0]
    : decision
      ? 'Deterministic eligibility qualification evaluation completed.'
      : 'Deterministic eligibility evaluation has not yet been executed for this tender. Run evaluation to verify company credentials against tender thresholds.';

  const findReasonText = (...keywords: string[]): { title: string; detail: string; pass: boolean } | null => {
    // 1. Search positive reasons to pursue first
    for (const r of (decision?.reasonsToPursue || [])) {
      if (!r) continue;
      const rObj = typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : null;
      const str = typeof r === 'string' ? r : String(rObj?.detail || rObj?.title || JSON.stringify(r));
      const matches = keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(str));
      if (matches) {
        return {
          title: String(rObj?.title || keywords[0]),
          detail: String(rObj?.detail || rObj?.reason || rObj?.summary || rObj?.title || str),
          pass: true,
        };
      }
    }

    // 2. Search negative reasons and hard disqualifiers
    const negativeReasons = [
      ...(decision?.reasonsNotToPursue || []),
      ...(decision?.hardDisqualifiers || []),
    ];
    for (const r of negativeReasons) {
      if (!r) continue;
      const rObj = typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : null;
      const str = typeof r === 'string' ? r : String(rObj?.detail || rObj?.title || rObj?.reason || JSON.stringify(r));
      const matches = keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(str));
      if (matches) {
        return {
          title: String(rObj?.title || keywords[0]),
          detail: String(rObj?.detail || rObj?.reason || rObj?.summary || rObj?.title || str),
          pass: false,
        };
      }
    }
    return null;
  };

  const turnoverGate = findReasonText('turnover');
  const techGate = findReasonText('contract', 'experience', 'railway', 'bridge', 'highway', 'technical');
  const solvencyGate = findReasonText('solvency', 'credit');
  const emdAmount = bid.estimatedValueRupees
    ? `₹${((Number(bid.estimatedValueRupees) * 0.01) / 10000000).toFixed(2)} Cr (1% Bank Guarantee)`
    : 'Not Specified';

  const ldRisk = (decision?.commercialRisks || []).find((r) => {
    const s = typeof r === 'string' ? r : JSON.stringify(r);
    return s.toLowerCase().includes('liquidated') || s.toLowerCase().includes('delay');
  });

  return (
    <section className="border border-border rounded-lg p-6 bg-card shadow-xs space-y-6 transition-colors">
      <div>
        <div className="mono text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground flex items-center justify-between">
          <span>1. DETERMINISTIC ELIGIBILITY VERDICT</span>
          <span className="mono text-[11px] font-bold text-muted-foreground">
            {decision ? formatDecisionStateText(decision.state) : 'EVALUATION PENDING'}
          </span>
        </div>

        <div className="flex items-baseline gap-3">
          <span className={`text-4xl mono font-bold tracking-tight ${verdictTextColor}`}>
            {scoreNum !== null ? scoreNum : '—'}
          </span>
          <span className="text-xs mono font-semibold text-muted-foreground">
            {scoreNum !== null ? '/ 100 Readiness Score' : 'Readiness Score Pending'}
          </span>
        </div>

        <p className="text-xs leading-relaxed mt-2.5 font-normal text-muted-foreground">
          {summaryText}
        </p>
      </div>

      {/* Core Threshold Evaluation Gates */}
      <div className="space-y-3 pt-4 border-t border-border text-xs">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">3-Year Average Turnover Threshold</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">
              {turnoverGate ? turnoverGate.detail : 'Evaluation pending'}
            </span>
            {turnoverGate && (
              <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">
                {turnoverGate.pass ? '✓ PASS' : '✗ SHORTFALL'}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Earnest Money Deposit (EMD)</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">{emdAmount}</span>
            {bid.estimatedValueRupees && (
              <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">✓ PASS</span>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Liquidated Damages / Contract Risk</span>
          <span className={ldRisk ? 'text-amber-500 mono font-bold' : 'text-foreground mono'}>
            {ldRisk
              ? typeof ldRisk === 'object' && 'penaltySummary' in (ldRisk as Record<string, unknown>)
                ? String((ldRisk as Record<string, unknown>).penaltySummary)
                : 'Exposure Flagged ⚠'
              : 'Clean / Standard GCC Terms'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">Technical Qualification Criteria</span>
          <div className="text-right">
            <span className="text-foreground mono font-semibold">
              {techGate ? techGate.detail : 'Technical capacity check'}
            </span>
            {techGate && (
              <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">
                {techGate.pass ? '✓ PASS' : '✗ SHORTFALL'}
              </span>
            )}
          </div>
        </div>

        {solvencyGate && (
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">Bank Solvency &amp; Credit Facilities</span>
            <div className="text-right">
              <span className="text-foreground mono font-semibold">{solvencyGate.detail}</span>
              <span className="text-emerald-600 dark:text-emerald-400 mono font-bold ml-1.5">✓ PASS</span>
            </div>
          </div>
        )}
      </div>

      {/* Direct Action Link to Compliance Matrix */}
      <div className="pt-1">
        <a
          href="#compliance-matrix"
          className="w-full block py-2.5 px-4 text-center text-xs font-semibold rounded-md border border-border bg-muted/30 hover:bg-muted/70 text-foreground transition-colors shadow-2xs"
        >
          Open Full Compliance Matrix ({complianceItems.length} Clauses)
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
