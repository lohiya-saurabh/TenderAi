/**
 * Source viewer: the stored text of the clause's page with the quote highlighted. Block
 * positions on the rendered PDF are not available yet, so the highlight is a text match on
 * the page's own text; when the quote is not in that text the viewer says so.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { DocumentPageText } from '@tenderpulse/shared-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageText } from '@/api/clauses.js';
import { Button } from '@/components/ui/button.js';

export interface SourceViewerProps {
  bidId: string;
  documentId: string;
  documentName: string | null;
  page: number;
  quote: string;
  /** Called once the clause's own page has been shown to the reviewer */
  onViewed?: () => void;
  unreadPages?: number[];
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
  bidId,
  documentId,
  documentName,
  page: clausePage,
  quote,
  onViewed,
  unreadPages = [],
}) => {
  const [page, setPage] = useState(clausePage);
  const [data, setData] = useState<DocumentPageText | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPage(clausePage), [clausePage, documentId]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void getPageText(bidId, documentId, page).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        if (page === clausePage) onViewed?.();
      } else setError(res.error.message);
    });
    return () => {
      cancelled = true;
    };
    // onViewed is intentionally not a dependency: viewing is recorded once per page load.
  }, [bidId, documentId, page, clausePage]);

  const text = useMemo(() => (data?.blocks ?? []).map((b) => b.text).join('\n\n'), [data]);
  const match = useMemo(() => locate(text, quote), [text, quote]);
  const unread = unreadPages.includes(page);

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card"
      aria-label="Source page"
      data-testid="source-viewer"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate font-medium">
          {documentName ?? 'Tender document'}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono tabular-nums" aria-live="polite">
          p.{page}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label="Next page"
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {unread && (
        <p
          className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300"
          data-testid="page-not-analysed"
        >
          Not analysed: the AI could not read this page, so requirements on it are missing from the
          list. Read it manually.
        </p>
      )}
      {page === clausePage && data && quote && (
        <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          {match
            ? 'Quote highlighted in the stored text of this page. Exact position on the PDF is not available yet.'
            : 'The quote was not found in the stored text of this page. Read the page and check the clause manually.'}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-serif text-sm leading-relaxed whitespace-pre-wrap">
        {error && <p className="text-destructive">{error}</p>}
        {!error && !data && <p className="text-muted-foreground">Loading page…</p>}
        {data && data.blocks.length === 0 && (
          <p className="text-muted-foreground">
            No stored text for this page. Read it in the original PDF.
          </p>
        )}
        {data && data.blocks.length > 0 && (
          <Highlighted text={text} match={page === clausePage ? match : null} />
        )}
      </div>
    </section>
  );
};

const Highlighted: React.FC<{ text: string; match: [number, number] | null }> = ({
  text,
  match,
}) => {
  const ref = React.useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'center' });
  }, [match]);
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match[0])}
      <mark
        ref={ref}
        className="rounded bg-yellow-200 px-0.5 text-black dark:bg-yellow-300"
        data-testid="source-highlight"
      >
        {text.slice(match[0], match[1])}
      </mark>
      {text.slice(match[1])}
    </>
  );
};

/** Start/end of the quote in the page text, tolerant of whitespace differences. */
export function locate(text: string, quote: string): [number, number] | null {
  if (!text || !quote.trim()) return null;
  const exact = text.indexOf(quote);
  if (exact >= 0) return [exact, exact + quote.length];
  const words = quote
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(words.join('\\s+'), 'i');
  const m = re.exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}
