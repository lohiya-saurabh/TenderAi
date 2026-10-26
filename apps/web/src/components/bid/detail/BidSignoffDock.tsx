import React from 'react';
import { useCompany } from '@/context/useCompany.js';

export interface BidSignoffDockProps {
  activeSection?: string;
}

/** Section outline + company verification status. The previous hard-coded
 *  PASSED/FLAGGED sign-off rows and alert() buttons were removed: they showed
 *  results that were never computed. */
export const BidSignoffDock: React.FC<BidSignoffDockProps> = () => {
  const { selectedCompany } = useCompany();
  const isGstVerified = Boolean(selectedCompany?.gstinVerifiedAt);
  const isMcaVerified = Boolean(selectedCompany?.mcaVerifiedAt);
  const isUdyamVerified = Boolean(selectedCompany?.udyamVerifiedAt);

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

      {/* 3. Evidence Vault Summary */}
      <div className="p-4 border border-border rounded-lg bg-card/60 shadow-xs space-y-2 text-[11px] transition-colors">
        <div className="mono uppercase font-semibold text-muted-foreground">
          Evidence Vault Status
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${isGstVerified ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
          />
          <span
            className={
              isGstVerified
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-muted-foreground'
            }
          >
            IRIS GST {isGstVerified ? 'Verified (Active)' : '(Unverified)'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${isMcaVerified ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
          />
          <span
            className={
              isMcaVerified
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-muted-foreground'
            }
          >
            MCA RoC CIN {isMcaVerified ? 'Active' : '(Unverified)'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${isUdyamVerified ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
          />
          <span
            className={
              isUdyamVerified
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-muted-foreground'
            }
          >
            MSME Udyam {isUdyamVerified ? 'Verified' : '(Unverified)'}
          </span>
        </div>
      </div>
    </aside>
  );
};
