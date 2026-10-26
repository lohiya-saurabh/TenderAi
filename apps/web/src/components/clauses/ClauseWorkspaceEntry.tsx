/**
 * Bid overview entry to the clause workspace: review progress and the counts that need
 * attention, each opening the matching saved view. Zero states say what was checked.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BidClauseSummary } from '@tenderpulse/shared-types';
import { getClauseSummary } from '@/api/clauses.js';
import { Button } from '@/components/ui/button.js';

export const ClauseWorkspaceEntry: React.FC<{ bidId: string; refreshKey?: unknown }> = ({
  bidId,
  refreshKey,
}) => {
  const [summary, setSummary] = useState<BidClauseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getClauseSummary(bidId).then((res) => {
      if (cancelled) return;
      if (res.ok) setSummary(res.data);
      else setError(res.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [bidId, refreshKey]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!summary) return <p className="text-sm text-muted-foreground">Loading clauses…</p>;

  const r = summary.review;
  const reviewed = r.CONFIRMED + r.CORRECTED + r.NOT_A_REQUIREMENT;
  const tiles: { label: string; n: number; to: string; zero: string }[] = [
    {
      label: 'Conflicts',
      n: summary.attention.conflicts,
      to: 'view=conflict',
      zero: 'No conflicts detected in analysed pages',
    },
    {
      label: 'Pages not analysed',
      n: summary.attention.pagesNotAnalysed,
      to: 'verify=1',
      zero: 'Every page was analysed',
    },
    {
      label: 'Disqualifying & unreviewed',
      n: summary.attention.disqualifyingUnreviewed,
      to: 'view=dq',
      zero: 'None open',
    },
    {
      label: 'Quote not found',
      n: summary.attention.quoteNotFound,
      to: 'flag=QUOTE_NOT_FOUND',
      zero: 'All quotes found',
    },
    {
      label: 'Needs an outside party',
      n: summary.attention.needsOutsideParty,
      to: 'view=outside',
      zero: 'None stated',
    },
  ];

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-5"
      aria-labelledby="clause-entry-title"
      data-testid="clause-entry"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="clause-entry-title" className="text-base font-bold tracking-tight">
            Clauses
          </h2>
          <p className="text-xs text-muted-foreground">
            {summary.clauses} clauses from {summary.documents} document
            {summary.documents === 1 ? '' : 's'} · {reviewed} reviewed · {r.NEEDS_REVIEW} marked
            needs review
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to={`/bids/${bidId}/clauses`}>Open clause workspace ({summary.clauses})</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/bids/${bidId}/conflicts`}>Conflicts</Link>
          </Button>
        </div>
      </div>
      <progress
        className="h-1.5 w-full"
        value={reviewed}
        max={Math.max(summary.clauses, 1)}
        aria-label="Review progress"
      />
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={`/bids/${bidId}/clauses?${t.to}`}
            className="rounded-lg border border-border p-3 hover:bg-muted/50"
            data-testid="attention-tile"
          >
            <div className="text-xs text-muted-foreground">{t.label}</div>
            {t.n > 0 ? (
              <div className="text-xl font-semibold tabular-nums">{t.n}</div>
            ) : (
              <div className="pt-1 text-xs text-foreground/80">{t.zero}</div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
};
