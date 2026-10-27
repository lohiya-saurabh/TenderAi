import React, { useState } from 'react';
import type { FinancialSummaryCardDto } from '@tenderpulse/shared-types';
import { CheckCircle2, XCircle, AlertTriangle, Copy, Check } from 'lucide-react';

interface FinancialSummaryCardProps {
  summary: FinancialSummaryCardDto;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({ summary }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyUdin = async () => {
    if (summary.udin && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(summary.udin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently handle clipboard write error in non-secure or restricted environments
      }
    }
  };

  const getVerdictStyles = () => {
    switch (summary.verdict) {
      case 'PASS':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
          title: 'Qualified',
        };
      case 'FAIL':
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
          badge: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
          title: 'Disqualified',
        };
      case 'REVIEW':
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          badge: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
          title: 'Review Required',
        };
    }
  };

  const styles = getVerdictStyles();

  return (
    <div className="mt-3 mb-2 p-3.5 rounded-lg border border-border/80 bg-background/90 dark:bg-card/90 shadow-2xs">
      <div className="flex items-start justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-border/60">
        <div className="flex items-start gap-2 font-semibold text-xs text-foreground tracking-tight min-w-0">
          <span className="shrink-0 mt-0.5">{styles.icon}</span>
          <span className="leading-snug">{summary.metricName}</span>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles.badge}`}
        >
          {summary.verdict}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Required</div>
          <div className="font-mono font-semibold text-foreground text-xs mt-1 tracking-tight">{summary.requiredValue}</div>
        </div>
        <div className="p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 border border-border/50">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Actual Filed</div>
          <div className="font-mono font-semibold text-foreground text-xs mt-1 tracking-tight">{summary.actualValue}</div>
        </div>
      </div>

      {summary.udin && (
        <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/40 dark:bg-muted/20 rounded-md border border-border/50">
          <span className="text-muted-foreground font-mono text-[11px] select-all">
            UDIN: {summary.udin}
          </span>
          <button
            type="button"
            onClick={handleCopyUdin}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer shadow-2xs font-medium"
            title="Copy UDIN"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}

      {summary.details && (
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">{summary.details}</p>
      )}
    </div>
  );
};
