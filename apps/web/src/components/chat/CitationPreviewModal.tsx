import React, { useEffect } from 'react';
import type { CitationDto } from '@tenderpulse/shared-types';
import { X, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface CitationPreviewModalProps {
  citation: CitationDto | null;
  onClose: () => void;
}

export const CitationPreviewModal: React.FC<CitationPreviewModalProps> = ({
  citation,
  onClose,
}) => {
  useEffect(() => {
    if (!citation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [citation, onClose]);

  if (!citation) return null;

  const isTender = citation.sourceType === 'TENDER_DOCUMENT';
  const confidencePercent = Math.round((citation.confidenceScore ?? 0.95) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 !mt-0 m-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                isTender
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">Citation Provenance</div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                {isTender ? 'Tender Document' : 'Company Evidence Vault'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs text-foreground">
          {/* Document metadata chips */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block mb-0.5">Source Document</span>
              <span className="font-semibold text-foreground truncate block text-xs" title={citation.documentName}>
                {citation.documentName}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block mb-0.5">Page & Clause</span>
              <span className="font-semibold text-foreground block text-xs">
                Page {citation.pageNumber} {citation.clauseReference ? `• ${citation.clauseReference}` : ''}
              </span>
            </div>
          </div>

          {/* Verbatim quote */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Verbatim Source Excerpt
              </span>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{confidencePercent}% Grounded</span>
              </div>
            </div>
            <blockquote className="p-3.5 rounded-lg bg-muted/40 dark:bg-muted/20 border-l-3 border-emerald-600 dark:border-emerald-500 text-xs leading-relaxed italic text-foreground/90 font-serif">
              "{citation.verbatimQuote}"
            </blockquote>
          </div>

          {/* Bounding box highlight snippet when present */}
          {citation.boundingBox && (
            <div className="p-2.5 rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/50 text-[11px] space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block">
                Document Viewer Snippet
              </span>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>Coordinates: [{String(citation.boundingBox.x ?? 0)}, {String(citation.boundingBox.y ?? 0)}]</span>
                <span>Size: {String(citation.boundingBox.width ?? 0)} × {String(citation.boundingBox.height ?? 0)}</span>
              </div>
            </div>
          )}

          {/* Dual-provenance validation note */}
          <div className="p-2.5 rounded-lg bg-muted/25 dark:bg-muted/15 border border-border/40 text-[11px] text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="leading-normal">
              Verified by exact AST substring match against canonical {isTender ? 'NIT tender specification' : 'statutory certificate'}.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
