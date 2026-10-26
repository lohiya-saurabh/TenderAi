import React from 'react';
import type { ComplianceItem } from '@/api/compliance.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { getObligationsSummary, type ObligationsSummary } from '@/components/bid/detail/bidDetailData.js';

export interface ObligationsCardProps {
  items: ComplianceItem[];
}

/**
 * Execution formalities (stamp paper, notarisation, UDIN, named signatory) aggregated from
 * the clauses that state them. Formalities no clause states are not shown.
 */
export const ObligationsCard: React.FC<ObligationsCardProps> = ({ items }) => {
  const obligations = getObligationsSummary(items);

  // Risk and attention (conflicts, disqualifying clauses, unread pages) live in the Clauses
  // card and workspace; this card only lists the execution formalities the tender states.
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold tracking-tight text-foreground">
        3. Execution formalities stated in the tender
      </h2>
      <div className="border border-border rounded-xl p-5 sm:p-6 bg-card shadow-xs transition-colors">
        <ObligationGrid summary={obligations} />
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
          'Not stated'
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

  // Only formalities a clause actually states; never greyed "not mandated" tiles.
  const stated = obligations.filter((o) => o.active);
  if (stated.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No execution formalities (stamp paper, notarisation, UDIN, named signatory) stated in the
        extracted clauses.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
      {stated.map((obligation) => (
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
