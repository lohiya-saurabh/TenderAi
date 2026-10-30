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
          icon: <CheckCircle2 className="w-4 h-4 text-success dark:text-success shrink-0" />,
          badge: 'bg-success/10 text-success border-success/30 dark:bg-success/70 dark:text-success dark:border-success/40',
          title: 'Qualified',
        };
      case 'FAIL':
        return {
          icon: <XCircle className="w-4 h-4 text-destructive dark:text-destructive shrink-0" />,
          badge: 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/70 dark:text-destructive dark:border-destructive/40',
          title: 'Disqualified',
        };
      case 'REVIEW':
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4 text-warning dark:text-warning shrink-0" />,
          badge: 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/70 dark:text-warning dark:border-warning/40',
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
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider border ${styles.badge}`}
        >
          {summary.verdict}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 border border-border/50">
          <div className="text-2xs text-muted-foreground uppercase font-semibold tracking-wider">Required</div>
          <div className="font-mono font-semibold text-foreground text-xs mt-1 tracking-tight">{summary.requiredValue}</div>
        </div>
        <div className="p-2.5 rounded-md bg-muted/40 dark:bg-muted/20 border border-border/50">
          <div className="text-2xs text-muted-foreground uppercase font-semibold tracking-wider">Actual Filed</div>
          <div className="font-mono font-semibold text-foreground text-xs mt-1 tracking-tight">{summary.actualValue}</div>
        </div>
      </div>

      {summary.udin && (
        <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 bg-muted/40 dark:bg-muted/20 rounded-md border border-border/50">
          <span className="text-muted-foreground font-mono text-2xs select-all">
            UDIN: {summary.udin}
          </span>
          <button
            type="button"
            onClick={handleCopyUdin}
            className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer shadow-2xs font-medium"
            title="Copy UDIN"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-success dark:text-success" />
                <span className="text-success dark:text-success font-semibold">Copied</span>
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
        <p className="mt-2 text-2xs text-muted-foreground leading-relaxed">{summary.details}</p>
      )}
    </div>
  );
};
