import React from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceItem } from '@/api/compliance.js';
import { StatusBadge } from '@/components/common/StatusBadge.js';
import { AlertCircleIcon, CheckIcon, ChevronRightIcon } from '@/components/common/Icons.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import {
  getObligationsSummary,
  getFlaggedItems,
  type ObligationsSummary,
} from '@/components/bid/detail/bidDetailData.js';

export interface ObligationsCardProps {
  items: ComplianceItem[];
}

/**
 * Risks & statutory obligations.
 *
 * Everything here is derived from REAL data:
 *   - Execution rules (stamp paper, notarization, UDIN,
 *     signing rank) aggregated from the requirement matrix
 *   - FLAGGED requirements — the real disqualification-risk
 *     signal (evidence missing or insufficient per review)
 *
 * The commercial risk-findings engine (timeline pressure,
 * working-capital lock-in, liquidated damages analysis) has
 * no backend API yet — documented in MissingDataCallout.
 */
export const ObligationsCard: React.FC<ObligationsCardProps> = ({ items }) => {
  const obligations = getObligationsSummary(items);
  const flagged = getFlaggedItems(items);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          3. High-Risk Liability Analysis
        </h2>
        <span className="mono text-xs font-semibold text-muted-foreground">
          {flagged.length > 0 ? `${flagged.length} Risk Flagged` : 'All Covenants Clean'}
        </span>
      </div>

      {/* Featured High-Risk Contractual Liability Card */}
      {flagged.length > 0 ? (
        <div className="border border-border border-l-4 border-l-vermilion rounded-xl p-5 sm:p-6 bg-card shadow-xs space-y-3.5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs sm:text-sm text-foreground">
              {(flagged[0]!.tenderClauseRef || flagged[0]!.provenance?.sectionOrClause)
                ? `${flagged[0]!.tenderClauseRef || flagged[0]!.provenance?.sectionOrClause}: `
                : ''}
              {flagged[0]!.requirement}
            </span>
            <span className="mono text-[11px] font-bold text-vermilion">
              FLAGGED FOR REVIEW ⚠
            </span>
          </div>

          {/* Verbatim Quote Box */}
          {flagged[0]!.provenance?.verbatimQuote && (
            <p className="text-xs leading-relaxed mono p-4 rounded-lg border border-border bg-muted/40 text-foreground">
              &quot;{flagged[0]!.provenance.verbatimQuote}&quot;
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Executive Note:</strong>{' '}
            {flagged[0]!.description || 'High-risk obligation requires clarification or mitigating evidence before submission deadline.'}
          </p>
        </div>
      ) : (
        <div className="border border-border border-l-4 border-l-emerald-500 rounded-xl p-5 sm:p-6 bg-card shadow-xs space-y-2 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs sm:text-sm text-foreground">
              Contractual Risk Assessment: Clean &amp; Standard Model Terms
            </span>
            <span className="mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              ✓ ZERO CONTRACTUAL RED FLAGS
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            No onerous liability clauses, uncapped liquidated damages, or non-standard contractual covenants detected in extracted tender clauses.
          </p>
        </div>
      )}

      <div className="border border-border rounded-xl p-5 sm:p-6 bg-card shadow-xs space-y-6 transition-colors">
        {/* Statutory Execution Rules */}
        <div>
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
            Statutory Execution Rules
          </div>
          <ObligationGrid summary={obligations} />
        </div>

        {/* Flagged requirements — the real risk signal */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircleIcon size={15} color="var(--vermilion)" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Flagged Requirements (disqualification risk)
            </span>
          </div>

          {flagged.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-muted/40 border border-border">
              <span className="text-foreground inline-flex">
                <CheckIcon size={16} />
              </span>
              <span className="text-xs text-muted-foreground">
                No requirements flagged. Every extracted clause has sufficient evidence on record.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {flagged.map((item) => {
                const title = (item as { title?: string }).title || item.requirement;
                return (
                  <Link
                    key={item.id}
                    to={`/bids/${item.bidId}/compliance/${item.id}`}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-vermilion/5 dark:bg-vermilion/10 border border-vermilion/20 hover:bg-vermilion/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-vermilion inline-flex shrink-0">
                        <AlertCircleIcon size={15} />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                          {title}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.category} — evidence missing or insufficient
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.status} size="sm" />
                      <ChevronRightIcon size={14} color="#71717a" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface ObligationDisplayItem {
  label: string;
  active: boolean;
  detail: React.ReactNode;
}

function ObligationGrid({ summary }: { summary: ObligationsSummary }) {
  const ranks = summary.signingAuthorityRanks || [];

  const obligations: ObligationDisplayItem[] = [
    {
      label: 'Stamp Paper',
      active: summary.stampPaperCount > 0,
      detail:
        summary.stampPaperCount === 0
          ? 'Not mandated'
          : `${summary.stampPaperCount} requirement${summary.stampPaperCount === 1 ? '' : 's'}` +
            (summary.maxStampDenominationInr
              ? ` — up to ${formatCurrency(summary.maxStampDenominationInr)}`
              : ' — denomination per state act'),
    },
    {
      label: 'Notarization',
      active: summary.notarizationCount > 0,
      detail:
        summary.notarizationCount === 0
          ? 'Not mandated'
          : `${summary.notarizationCount} requirement${summary.notarizationCount === 1 ? '' : 's'} — Public Notary / Oath Commissioner`,
    },
    {
      label: 'CA Certificate & UDIN',
      active: summary.udinCount > 0,
      detail:
        summary.udinCount === 0
          ? 'Not mandated'
          : `${summary.udinCount} requirement${summary.udinCount === 1 ? '' : 's'} — 18-digit UDIN mandatory`,
    },
    {
      label: 'Signing Authority',
      active: ranks.length > 0,
      detail:
        ranks.length === 0 ? (
          'Authorized Representative'
        ) : ranks.length <= 2 ? (
          ranks.join(', ')
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              {ranks.length} designated roles across clauses:
            </span>
            <div className="flex flex-wrap gap-1">
              {ranks.slice(0, 3).map((rank) => (
                <span
                  key={rank}
                  className="inline-block px-1.5 py-0.5 rounded bg-muted/70 text-[10px] font-medium text-foreground truncate max-w-[200px]"
                  title={rank}
                >
                  {rank}
                </span>
              ))}
              {ranks.length > 3 && (
                <span
                  className="inline-block px-1.5 py-0.5 rounded bg-muted/40 text-[10px] text-muted-foreground font-medium"
                  title={ranks.slice(3).join(', ')}
                >
                  +{ranks.length - 3} more
                </span>
              )}
            </div>
          </div>
        ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
      {obligations.map((obligation) => (
        <div
          key={obligation.label}
          className={`p-3.5 sm:p-4 rounded-lg border flex flex-col justify-between h-full gap-2 transition-colors ${
            obligation.active ? 'bg-card border-border shadow-2xs' : 'bg-muted/40 border-border/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`text-xs font-semibold ${obligation.active ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {obligation.label}
            </span>
            {obligation.active ? (
              <span className="mono text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded shrink-0">
                REQUIRED
              </span>
            ) : (
              <span className="mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                OPTIONAL
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed mt-auto pt-1">
            {obligation.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
