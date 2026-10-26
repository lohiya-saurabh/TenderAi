/**
 * Conflicts view: where the tender states different values for the same thing. Each value
 * shows its own clause text; the AI note is labelled as AI text; the bidder accepts a value,
 * records a corrigendum, or drafts a pre-bid query that cites both clauses.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Conflict, ConflictResolution } from '@tenderpulse/shared-types';
import { listConflicts, resolveConflict } from '@/api/clauses.js';
import { getBid } from '@/api/bids.js';
import { useSetBidBreadcrumbTitle } from '@/components/layout/BreadcrumbTitle.js';
import { Button } from '@/components/ui/button.js';
import { Chip } from '@/components/clauses/ClauseChips.js';
import { usePermission } from '@/hooks/usePermission.js';
import { PERMISSIONS } from '@/utils/permissions.js';

const RESOLUTION_LABEL: Record<ConflictResolution, string> = {
  UNRESOLVED: 'Unresolved',
  ACCEPTED_VALUE: 'Value accepted',
  QUERY_RAISED: 'Pre-bid query raised',
  RESOLVED_BY_CORRIGENDUM: 'Resolved by corrigendum',
};

/** Draft written from the two clauses (a template, not AI text); the bidder edits it. */
export function draftQuery(c: Conflict): string {
  const cited = c.values
    .map(
      (v) =>
        `${v.clauseRef ? `Clause ${v.clauseRef}` : 'the clause'} (page ${v.page}) states "${v.quote}"`,
    )
    .join(', while ');
  return `${cited}. Kindly clarify which ${c.attribute.toLowerCase()} applies.`;
}

export const ConflictsPage: React.FC = () => {
  const { id: bidId = '' } = useParams<{ id: string }>();
  const canReview = usePermission(PERMISSIONS.COMPLIANCE_REVIEW);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bidTitle, setBidTitle] = useState<string | null>(null);
  useSetBidBreadcrumbTitle(bidId, bidTitle);

  useEffect(() => {
    let cancelled = false;
    void getBid(bidId).then((res) => {
      if (!cancelled && res.ok) setBidTitle(res.data.title);
    });
    return () => {
      cancelled = true;
    };
  }, [bidId]);

  const load = useCallback(async () => {
    const res = await listConflicts(bidId);
    if (res.ok) setConflicts(res.data);
    else setError(res.error.message);
  }, [bidId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unresolved = conflicts?.filter((c) => c.resolution === 'UNRESOLVED').length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-[22px] font-bold">
          Conflicts · {conflicts?.length ?? 0} · {unresolved} unresolved
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The tender states different values for the same thing. Accept one with a reason, or ask
          the authority before the pre-bid query deadline.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {conflicts && conflicts.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No conflicts detected in the analysed pages.
        </p>
      )}
      {conflicts?.map((c) => (
        <ConflictCard
          key={c.id}
          bidId={bidId}
          conflict={c}
          canReview={canReview}
          onChanged={(next) =>
            setConflicts((prev) => prev?.map((x) => (x.id === next.id ? next : x)) ?? prev)
          }
          onError={setError}
        />
      ))}
    </div>
  );
};

const ConflictCard: React.FC<{
  bidId: string;
  conflict: Conflict;
  canReview: boolean;
  onChanged: (c: Conflict) => void;
  onError: (message: string) => void;
}> = ({ bidId, conflict: c, canReview, onChanged, onError }) => {
  const [query, setQuery] = useState(() => draftQuery(c));
  const [corrigendum, setCorrigendum] = useState('');
  const [busy, setBusy] = useState(false);
  const open = c.resolution === 'UNRESOLVED';

  const resolve = async (
    resolution: ConflictResolution,
    extra: { chosenClauseId?: string; note?: string } = {},
  ) => {
    setBusy(true);
    const res = await resolveConflict(bidId, c.id, {
      resolution,
      expectedVersion: c.version,
      ...extra,
    });
    setBusy(false);
    if (res.ok) onChanged(res.data);
    else onError(res.error.message);
  };

  return (
    <article
      id={c.id}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
      aria-labelledby={`${c.id}-title`}
      data-testid="conflict-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${c.id}-title`} className="text-base font-semibold">
          {c.attribute}
        </h2>
        <Chip tone={open ? 'bad' : 'ok'}>
          {RESOLUTION_LABEL[c.resolution]}
          {c.resolvedBy ? ` · ${c.resolvedBy.name}` : ''}
        </Chip>
        <span className="ml-auto text-xs text-muted-foreground">{c.topic}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {c.values.map((v) => (
          <div
            key={v.clauseId}
            className={`flex flex-col gap-2 rounded-md border p-3 ${c.chosenClauseId === v.clauseId ? 'border-foreground' : 'border-border'} ${c.chosenClauseId && c.chosenClauseId !== v.clauseId ? 'opacity-60' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <strong
                className={`text-lg tabular-nums ${c.chosenClauseId && c.chosenClauseId !== v.clauseId ? 'line-through' : ''}`}
              >
                {v.display}
              </strong>
              <Link
                to={`/bids/${bidId}/clauses?clause=${encodeURIComponent(v.clauseId)}`}
                className="font-mono text-xs underline-offset-2 hover:underline"
              >
                {v.clauseRef ?? 'No clause no.'} · p.{v.page}
              </Link>
            </div>
            <blockquote className="m-0 rounded-lg border border-[var(--quote-border)] bg-[var(--quote-bg)] px-[11px] py-[9px] font-serif text-[13.5px] leading-[1.5] text-[#22262E] dark:text-white/85">
              {v.quote}
            </blockquote>
            {canReview && open && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void resolve('ACCEPTED_VALUE', {
                    chosenClauseId: v.clauseId,
                    note: `Accepted ${v.display}`,
                  })
                }
              >
                Accept {v.display}
              </Button>
            )}
          </div>
        ))}
      </div>
      {c.aiPrecedenceNote && (
        <div className="rounded-md bg-violet-500/10 p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            AI suggestion — not tender text
          </div>
          {c.aiPrecedenceNote}
        </div>
      )}
      {c.note && !open && <p className="text-sm text-muted-foreground">Note: {c.note}</p>}

      {canReview && open && (
        <>
          <section
            className="space-y-2 rounded-md border border-border p-3"
            aria-label="Draft pre-bid query"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Draft pre-bid query</h3>
              <span className="text-xs text-muted-foreground">
                Written from the two clauses · edit before sending
              </span>
            </div>
            <textarea
              className="h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Pre-bid query text"
              data-testid="query-draft"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void navigator.clipboard?.writeText(query)}>
                Copy query
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void resolve('QUERY_RAISED', { note: query })}
              >
                Mark query as sent
              </Button>
            </div>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-8 min-w-[240px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
              placeholder="Corrigendum that resolves this (e.g. Corrigendum 1, item 3)"
              value={corrigendum}
              onChange={(e) => setCorrigendum(e.target.value)}
              aria-label="Corrigendum reference"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !corrigendum.trim()}
              onClick={() => void resolve('RESOLVED_BY_CORRIGENDUM', { note: corrigendum.trim() })}
            >
              Resolved by corrigendum
            </Button>
          </div>
        </>
      )}
      {canReview && !open && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void resolve('UNRESOLVED')}
        >
          Reopen
        </Button>
      )}
    </article>
  );
};
