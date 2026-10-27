/**
 * Clause workspace: every extracted clause in document order, grouped by section, with
 * faceted filters, saved views, a non-modal clause panel, a source viewer and review
 * actions. The whole view lives in the URL.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
  Clause,
  ClauseDetail,
  ClauseReviewRequest,
  Coverage,
  ReviewAction,
  ReviewStatus,
} from '@tenderpulse/shared-types';
import { ArrowLeft, Keyboard } from 'lucide-react';
import {
  bulkReviewClauses,
  getClause,
  getCoverage,
  listClauses,
  reviewClause,
} from '@/api/clauses.js';
import { Button } from '@/components/ui/button.js';
import { usePermission } from '@/hooks/usePermission.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { cn } from '@/lib/utils.js';
import { ClauseList } from '@/components/clauses/ClauseList.js';
import { ClausePanel } from '@/components/clauses/ClausePanel.js';
import { ClauseFilters } from '@/components/clauses/ClauseFilters.js';
import { SourceViewer } from '@/components/clauses/SourceViewer.js';
import { REVIEW_LABEL } from '@/components/clauses/clauseFormat.js';
import {
  PRESETS,
  activeFilterCount,
  bulkEligible,
  filterClauses,
  groupClauses,
  parseView,
  presetCounts,
  serializeView,
  type GroupBy,
  type WorkspaceView,
} from '@/components/clauses/workspaceState.js';

interface Toast {
  message: string;
  undo?: () => void;
  reload?: boolean;
}

const SHORTCUTS_KEY = 'tp.clauseShortcuts';

function readShortcutsPref(): boolean {
  try {
    return window.localStorage.getItem(SHORTCUTS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const ClauseWorkspacePage: React.FC = () => {
  const { id: bidId = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => parseView(params), [params]);
  const canReview = usePermission(PERMISSIONS.COMPLIANCE_REVIEW);

  const [clauses, setClauses] = useState<Clause[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [detail, setDetail] = useState<ClauseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [inlineSource, setInlineSource] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [shortcuts, setShortcuts] = useState(readShortcutsPref);
  const [viewerOverride, setViewerOverride] = useState<{ documentId: string; page: number } | null>(
    null,
  );
  const [search, setSearch] = useState(view.q);
  const [showFilters, setShowFilters] = useState(false);

  const update = useCallback(
    (patch: Partial<WorkspaceView>) => {
      setParams(serializeView({ ...parseView(params), ...patch }), { replace: true });
    },
    [params, setParams],
  );

  const load = useCallback(async () => {
    const [list, cov] = await Promise.all([listClauses(bidId), getCoverage(bidId)]);
    if (list.ok) {
      setClauses(list.data.clauses);
      setLoadError(null);
    } else setLoadError(list.error.message);
    if (cov.ok) setCoverage(cov.data);
  }, [bidId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== view.q) update({ q: search });
    }, 200);
    return () => clearTimeout(t);
  }, [search, view.q, update]);

  const visible = useMemo(() => (clauses ? filterClauses(clauses, view) : []), [clauses, view]);
  const groups = useMemo(() => groupClauses(visible, view.group), [visible, view.group]);
  const order = useMemo(() => groups.flatMap((g) => g.clauses.map((c) => c.id)), [groups]);
  const counts = useMemo(() => (clauses ? presetCounts(clauses) : null), [clauses]);
  const selectedId = view.clause;

  // Load the selected clause's detail.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setCorrecting(false);
    setInlineSource(false);
    void getClause(bidId, selectedId).then((res) => {
      if (cancelled) return;
      setDetailLoading(false);
      setDetail(res.ok ? res.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [bidId, selectedId]);

  const select = useCallback((id: string | null) => update({ clause: id }), [update]);
  const step = useCallback(
    (delta: number) => {
      if (order.length === 0) return;
      const i = selectedId ? order.indexOf(selectedId) : -1;
      const next = i < 0 ? 0 : Math.min(order.length - 1, Math.max(0, i + delta));
      select(order[next]!);
    },
    [order, selectedId, select],
  );

  const markOpened = useCallback((id: string) => {
    setOpened((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const replaceClause = useCallback((next: ClauseDetail) => {
    setDetail(next);
    setClauses(
      (prev) => prev?.map((c) => (c.id === next.id ? { ...c, ...stripDetail(next) } : c)) ?? prev,
    );
  }, []);

  const runReview = useCallback(
    async (
      target: ClauseDetail,
      action: ReviewAction,
      extra: Partial<ClauseReviewRequest> = {},
      undoable = true,
    ) => {
      setBusy(true);
      const previous: ReviewStatus = target.review.status;
      const res = await reviewClause(bidId, target.id, {
        action,
        sourceOpened: opened.has(target.id),
        expectedVersion: target.review.version,
        ...extra,
      });
      setBusy(false);
      if (!res.ok) {
        if (res.error.status === 409) {
          setToast({
            message: 'Someone else updated this clause. Reload to see the changes.',
            reload: true,
          });
        } else setToast({ message: res.error.message });
        return;
      }
      replaceClause(res.data);
      setCorrecting(false);
      const ref = target.clauseRef ?? target.title;
      const label = REVIEW_LABEL[res.data.review.status].toLowerCase();
      const undoAction: ReviewAction | null =
        previous === 'UNREVIEWED'
          ? 'UNREVIEW'
          : previous === 'NEEDS_REVIEW'
            ? 'NEEDS_REVIEW'
            : null;
      setToast({
        message: `${ref}: ${label}`,
        undo:
          undoable && undoAction && action !== 'CORRECT'
            ? () => void runReview(res.data, undoAction, {}, false)
            : undefined,
      });
    },
    [bidId, opened, replaceClause],
  );

  const onReview = useCallback(
    (action: ReviewAction, extra?: Partial<ClauseReviewRequest>) => {
      if (detail) void runReview(detail, action, extra);
    },
    [detail, runReview],
  );

  const eligibleChecked = useMemo(
    () => (clauses ?? []).filter((c) => checked.has(c.id) && bulkEligible(c)),
    [clauses, checked],
  );

  const bulkConfirm = async () => {
    if (eligibleChecked.length === 0) return;
    setBusy(true);
    const res = await bulkReviewClauses(bidId, {
      action: 'CONFIRM',
      clauseIds: eligibleChecked.map((c) => c.id),
    });
    setBusy(false);
    if (!res.ok) {
      setToast({ message: res.error.message });
      return;
    }
    const skipped = checked.size - eligibleChecked.length;
    setChecked(new Set());
    setToast({
      message: `Confirmed ${res.data.confirmed} spot-check clauses${skipped ? `; ${skipped} skipped (need individual review)` : ''}.`,
    });
    await load();
  };

  // Keyboard review shortcuts (single keys; can be turned off).
  const handlers = useRef({ step, onReview, update, view, detail, canReview, correcting });
  handlers.current = { step, onReview, update, view, detail, canReview, correcting };
  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const h = handlers.current;
      const key = e.key.toLowerCase();
      if (key === 'j') h.step(1);
      else if (key === 'k') h.step(-1);
      else if (key === 'v') h.update({ verify: !h.view.verify });
      else if (key === 'o' && h.detail) {
        if (h.view.verify) return;
        setInlineSource(true);
      } else if (key === 'escape') setCorrecting(false);
      else if (!h.canReview || !h.detail || h.correcting) return;
      else if (key === 'a')
        document
          .querySelector<HTMLButtonElement>('[data-testid="review-confirm"]:not([disabled])')
          ?.click();
      else if (key === 'e') setCorrecting(true);
      else if (key === 'r') h.onReview('NOT_A_REQUIREMENT');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);

  const toggleShortcuts = () => {
    const next = !shortcuts;
    setShortcuts(next);
    try {
      window.localStorage.setItem(SHORTCUTS_KEY, next ? 'on' : 'off');
    } catch {
      /* preference is optional */
    }
  };

  useEffect(() => {
    if (!toast || toast.reload) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const total = clauses?.length ?? 0;
  const reviewed = (clauses ?? []).filter(
    (c) => !['UNREVIEWED', 'NEEDS_REVIEW'].includes(c.review.status),
  ).length;
  const needReview = counts?.needs ?? 0;
  const conflictCount = counts?.conflict ?? 0;
  const unreadPages = (coverage?.documents ?? []).flatMap((d) =>
    d.failedPages.map((p) => ({ doc: d, page: p.page })),
  );
  const unreadForDoc = (docId: string | null) =>
    (coverage?.documents.find((d) => d.id === docId)?.failedPages ?? []).map((p) => p.page);

  const viewerDoc = viewerOverride?.documentId ?? detail?.documentId ?? null;
  const viewerPage = viewerOverride?.page ?? detail?.pages.primary ?? 1;
  const viewer =
    viewerDoc && (detail || viewerOverride) ? (
      <SourceViewer
        bidId={bidId}
        documentId={viewerDoc}
        documentName={
          coverage?.documents.find((d) => d.id === viewerDoc)?.name ?? detail?.documentName ?? null
        }
        page={viewerPage}
        quote={viewerOverride ? '' : (detail?.quote ?? '')}
        unreadPages={unreadForDoc(viewerDoc)}
        onViewed={detail && !viewerOverride ? () => markOpened(detail.id) : undefined}
      />
    ) : null;

  const panel = (
    <ClausePanel
      bidId={bidId}
      clause={detail}
      loading={detailLoading}
      canReview={canReview}
      sourceOpened={detail ? opened.has(detail.id) : false}
      sourceSlot={view.verify ? null : inlineSource ? viewer : undefined}
      onOpenSource={() => {
        setViewerOverride(null);
        setInlineSource(true);
      }}
      onReview={onReview}
      onPrev={() => step(-1)}
      onNext={() => step(1)}
      onClose={() => select(null)}
      correcting={correcting}
      onCorrecting={setCorrecting}
      busy={busy}
    />
  );

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[560px] flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/bids/${bidId}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Bid overview
          </Link>
          <h1 className="text-lg font-semibold">Clause workspace</h1>
          {clauses && (
            <div
              className="flex min-w-[260px] flex-1 items-center gap-2 text-xs text-muted-foreground"
              data-testid="review-progress"
            >
              <progress
                className="h-1.5 w-32 overflow-hidden rounded [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground"
                value={reviewed}
                max={Math.max(total, 1)}
                aria-label="Review progress"
              />
              <span>
                {reviewed} of {total} reviewed · {needReview} need review · {conflictCount} in
                conflicts
              </span>
            </div>
          )}
          <Link
            to={`/bids/${bidId}/conflicts`}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            Conflicts view
          </Link>
        </div>

        {unreadPages.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
            role="status"
            data-testid="coverage-banner"
          >
            <span>
              {unreadPages.length === 1 ? 'Page' : 'Pages'}{' '}
              {unreadPages.map((u) => `${u.page} of ${u.doc.name}`).join(', ')} could not be read by
              the AI. Clauses on {unreadPages.length === 1 ? 'it' : 'them'} are missing.
            </span>
            {unreadPages.slice(0, 3).map((u) => (
              <button
                key={`${u.doc.id}-${u.page}`}
                type="button"
                className="min-h-6 rounded border border-amber-600/40 px-2 font-medium"
                onClick={() => {
                  setViewerOverride({ documentId: u.doc.id, page: u.page });
                  update({ verify: true });
                }}
              >
                View page {u.page}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clause text, AI summary, refs, forms"
            aria-label="Search clauses"
            className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Group by
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={view.group}
              onChange={(e) => update({ group: e.target.value as GroupBy })}
              aria-label="Group by"
            >
              <option value="section">Source section</option>
              <option value="task">Bidder task</option>
              <option value="stage">Stage</option>
              <option value="review">Review status</option>
              <option value="document">Document</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Density
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={view.density}
              onChange={(e) => update({ density: e.target.value as WorkspaceView['density'] })}
              aria-label="Row density"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          {selectedId && !view.verify && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              aria-pressed={showFilters}
            >
              Filters{activeFilterCount(view) ? ` (${activeFilterCount(view)})` : ''}
            </Button>
          )}
          <Button
            variant={view.verify ? 'default' : 'outline'}
            size="sm"
            onClick={() => update({ verify: !view.verify })}
            aria-pressed={view.verify}
          >
            Verify layout (V)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleShortcuts}
            aria-pressed={shortcuts}
            title="J/K move · A confirm · E correct · R not a requirement · O open source · V verify layout"
          >
            <Keyboard className="mr-1 h-4 w-4" /> Shortcuts {shortcuts ? 'on' : 'off'}
          </Button>
        </div>

        <div role="tablist" aria-label="Saved views" className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={view.preset === p.id}
              onClick={() => update({ preset: p.id })}
              className={cn(
                'min-h-8 rounded-md px-3 text-xs font-medium',
                view.preset === p.id
                  ? 'bg-foreground text-background'
                  : 'text-foreground/80 hover:bg-muted',
              )}
            >
              {p.label} <span className="tabular-nums opacity-70">{counts?.[p.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span data-testid="showing-count">
            Showing {visible.length} of {total}
          </span>
          {(activeFilterCount(view) > 0 || view.preset !== 'all') && (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setSearch('');
                update({ preset: 'all', q: '', review: [], band: [], flag: [], stage: [] });
              }}
            >
              Clear all
            </button>
          )}
          <span className="ml-auto">Order: document → page → position</span>
        </div>
      </div>

      {checked.size > 0 && canReview && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
          data-testid="batch-bar"
        >
          <span>{checked.size} selected</span>
          <Button
            size="sm"
            disabled={busy || eligibleChecked.length === 0}
            onClick={() => void bulkConfirm()}
          >
            Confirm {eligibleChecked.length} spot-check clauses
          </Button>
          {checked.size > eligibleChecked.length && (
            <span className="text-xs text-muted-foreground">
              {checked.size - eligibleChecked.length} flagged or non-spot-check clauses will be
              skipped
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-3',
          view.verify
            ? 'grid-cols-[300px_minmax(0,1fr)_420px]'
            : selectedId
              ? showFilters
                ? 'grid-cols-[220px_minmax(0,1fr)_minmax(400px,480px)]'
                : 'grid-cols-[minmax(0,1fr)_minmax(400px,480px)]'
              : 'grid-cols-[220px_minmax(0,1fr)]',
        )}
      >
        {!view.verify && clauses && (!selectedId || showFilters) && (
          <ClauseFilters clauses={clauses} view={view} onChange={update} />
        )}
        <section
          className="min-h-0 overflow-hidden rounded-lg border border-border bg-card"
          aria-label="Clause list"
        >
          {!clauses && !loadError && (
            <p className="p-4 text-sm text-muted-foreground">Loading clauses…</p>
          )}
          {clauses && visible.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {total === 0
                ? 'No clauses extracted for this tender yet.'
                : 'No clauses match this view.'}
            </div>
          )}
          {clauses && visible.length > 0 && (
            <ClauseList
              groups={groups}
              density={view.density}
              compact={view.verify}
              selectedId={selectedId}
              onSelect={(id) => {
                setViewerOverride(null);
                select(id);
              }}
              selectable={canReview && !view.verify}
              checked={checked}
              onToggleCheck={(id) =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          )}
        </section>
        {view.verify && (
          <div className="min-h-0">
            {viewer ?? (
              <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
                Select a clause to see its page.
              </div>
            )}
          </div>
        )}
        {(view.verify || selectedId) && <div className="min-h-0">{panel}</div>}
      </div>

      <div aria-live="polite" className="sr-only">
        {toast?.message}
      </div>
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          data-testid="toast"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="min-h-8 font-semibold underline"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
          {toast.reload && (
            <button
              type="button"
              className="min-h-8 font-semibold underline"
              onClick={() => {
                setToast(null);
                void load();
                if (selectedId)
                  void getClause(bidId, selectedId).then((r) => r.ok && setDetail(r.data));
              }}
            >
              Reload
            </button>
          )}
          <button
            type="button"
            className="min-h-8 px-1 opacity-70"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

function stripDetail(d: ClauseDetail): Clause {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { context, conflicts, history, prevId, nextId, ...clause } = d;
  return clause;
}
