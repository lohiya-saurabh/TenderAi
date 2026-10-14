import React from 'react';
import { Button } from '../../ui/button.js';
import { CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';

export interface BidSignoffDockProps {
  onApproveBid?: () => void;
  onSubmitPreBidQuery?: () => void;
  activeSection?: string;
}

export const BidSignoffDock: React.FC<BidSignoffDockProps> = ({
  onApproveBid,
  onSubmitPreBidQuery,
}) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="hidden lg:flex flex-col gap-5 sticky top-20 self-start select-none">
      {/* 1. Outline Navigation Card */}
      <div className="p-4 border border-border rounded-lg bg-card shadow-xs space-y-3 transition-colors">
        <div className="mono text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
          Section Outline
        </div>
        <nav className="space-y-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => scrollTo('memo-header')}
            className="block text-left text-foreground hover:underline cursor-pointer w-full"
          >
            1. Executive Memo Header
          </button>
          <button
            type="button"
            onClick={() => scrollTo('eligibility-verdict')}
            className="block text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
          >
            2. Eligibility Verdict
          </button>
          <button
            type="button"
            onClick={() => scrollTo('ingested-documents')}
            className="block text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
          >
            3. Ingested Documents
          </button>
          <button
            type="button"
            onClick={() => scrollTo('liability-analysis')}
            className="block text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
          >
            4. High-Risk Liability
          </button>
          <button
            type="button"
            onClick={() => scrollTo('compliance-matrix')}
            className="block text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full"
          >
            5. Compliance Matrix
          </button>
        </nav>
      </div>

      {/* 2. Sign-Off Status Dock */}
      <div className="p-4 border border-border rounded-lg bg-card shadow-xs space-y-3.5 transition-colors">
        <div className="mono text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
          Bid Sign-Off Status
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
              Technical Review
            </span>
            <span className="font-semibold text-foreground text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border border-border">
              PASSED
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
              Finance &amp; EMD
            </span>
            <span className="font-semibold text-foreground text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border border-border">
              PASSED
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              Legal / LD Cap
            </span>
            <span className="font-semibold text-orange-600 dark:text-orange-400 text-[11px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
              PENDING
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onApproveBid}
            className="w-full h-9 text-xs font-bold shadow-xs cursor-pointer"
          >
            Approve Bid Submission
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSubmitPreBidQuery}
            className="w-full h-8 text-xs font-semibold border-border cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Submit Pre-Bid Query</span>
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
