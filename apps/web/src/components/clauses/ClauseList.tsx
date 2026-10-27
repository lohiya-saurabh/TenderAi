/**
 * Virtualised, grouped clause list. Rows have a fixed height per density, so only the rows
 * in view (plus a small overscan) are in the DOM; the current group's header stays pinned.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Clause } from '@tenderpulse/shared-types';
import { cn } from '@/lib/utils.js';
import type { ClauseGroup, Density } from './workspaceState.js';
import {
  BAND_LABEL,
  FLAG_LABEL,
  REVIEW_LABEL,
  STAGE_LABEL,
  attestationChips,
  formatAmount,
  formatDeadline,
  typeLabel,
} from './clauseFormat.js';
import { Chip, ReviewBadge, flagTone } from './ClauseChips.js';

const GROUP_HEIGHT = 34;
const ROW_HEIGHT: Record<Density, number> = { compact: 52, comfortable: 92 };
const OVERSCAN = 6;

type Item =
  | { kind: 'group'; group: ClauseGroup; top: number; height: number }
  | { kind: 'row'; clause: Clause; group: ClauseGroup; top: number; height: number };

export interface ClauseListProps {
  groups: ClauseGroup[];
  density: Density;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectable: boolean;
  checked: Set<string>;
  onToggleCheck: (id: string) => void;
  compact?: boolean;
}

export const ClauseList: React.FC<ClauseListProps> = ({
  groups,
  density,
  selectedId,
  onSelect,
  selectable,
  checked,
  onToggleCheck,
  compact = false,
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const rowHeight = compact ? ROW_HEIGHT.compact : ROW_HEIGHT[density];

  const { items, total } = useMemo(() => {
    const out: Item[] = [];
    let top = 0;
    for (const group of groups) {
      out.push({ kind: 'group', group, top, height: GROUP_HEIGHT });
      top += GROUP_HEIGHT;
      for (const clause of group.clauses) {
        out.push({ kind: 'row', clause, group, top, height: rowHeight });
        top += rowHeight;
      }
    }
    return { items: out, total: top };
  }, [groups, rowHeight]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight || 600);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  // Keep the selected row in view (below the pinned group header).
  useEffect(() => {
    const el = scroller.current;
    const item = items.find((i) => i.kind === 'row' && i.clause.id === selectedId);
    if (!el || !item) return;
    if (item.top - GROUP_HEIGHT < el.scrollTop) el.scrollTop = Math.max(0, item.top - GROUP_HEIGHT);
    else if (item.top + item.height > el.scrollTop + el.clientHeight) {
      el.scrollTop = item.top + item.height - el.clientHeight;
    }
  }, [selectedId, items]);

  const onScroll = useCallback(() => setScrollTop(scroller.current?.scrollTop ?? 0), []);

  const start = Math.max(0, findFirst(items, scrollTop) - OVERSCAN);
  let end = start;
  while (end < items.length && items[end]!.top < scrollTop + viewport) end += 1;
  end = Math.min(items.length, end + OVERSCAN);
  const visible = items.slice(start, end);
  const pinned = [...items.slice(0, findFirst(items, scrollTop) + 1)]
    .reverse()
    .find((i) => i.kind === 'group');

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="relative h-full overflow-y-auto"
      style={{ scrollPaddingTop: GROUP_HEIGHT }}
      data-testid="clause-list"
    >
      {pinned && pinned.kind === 'group' && scrollTop > 0 && (
        // Zero-height sticky holder: the pinned header overlays the rows without taking space.
        <div className="sticky top-0 z-10 h-0">
          <GroupHeader group={pinned.group} sticky />
        </div>
      )}
      <div role="list" aria-label="Clauses" style={{ height: total, position: 'relative' }}>
        {visible.map((item) =>
          item.kind === 'group' ? (
            <div
              key={`g-${item.group.key}`}
              style={{
                position: 'absolute',
                top: item.top,
                left: 0,
                right: 0,
                height: item.height,
              }}
              role="presentation"
            >
              <GroupHeader group={item.group} />
            </div>
          ) : (
            <div
              key={item.clause.id}
              role="listitem"
              style={{
                position: 'absolute',
                top: item.top,
                left: 0,
                right: 0,
                height: item.height,
              }}
            >
              <ClauseRow
                clause={item.clause}
                selected={item.clause.id === selectedId}
                onSelect={onSelect}
                selectable={selectable}
                checked={checked.has(item.clause.id)}
                onToggleCheck={onToggleCheck}
                density={compact ? 'compact' : density}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
};

function findFirst(items: Item[], top: number): number {
  let lo = 0;
  let hi = items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (items[mid]!.top <= top) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const GroupHeader: React.FC<{ group: ClauseGroup; sticky?: boolean }> = ({ group, sticky }) => (
  <div
    className={cn(
      'flex items-baseline gap-2 px-3 text-xs bg-muted border-b border-border',
      sticky && 'shadow-sm',
    )}
    style={{ height: GROUP_HEIGHT, lineHeight: `${GROUP_HEIGHT}px` }}
    aria-hidden={sticky ? true : undefined}
  >
    <strong className="truncate text-foreground">{group.name}</strong>
    <span className="text-muted-foreground whitespace-nowrap">
      {group.clauses.length} · {group.needReview} need review
      {group.conflicts ? ` · ${group.conflicts} conflict` : ''}
    </span>
  </div>
);

const ClauseRow: React.FC<{
  clause: Clause;
  selected: boolean;
  onSelect: (id: string) => void;
  selectable: boolean;
  checked: boolean;
  onToggleCheck: (id: string) => void;
  density: Density;
}> = ({ clause: c, selected, onSelect, selectable, checked, onToggleCheck, density }) => {
  const type = typeLabel(c);
  const chips = attestationChips(c);
  const amount = c.amount ? formatAmount(c.amount) : null;
  const due = c.deadline ? formatDeadline(c.deadline, true) : '';
  const comfortable = density === 'comfortable';
  return (
    <div
      className={cn(
        'flex h-full border-b border-border bg-card transition-colors',
        selected ? 'bg-accent shadow-[inset_3px_0_0_hsl(var(--foreground))]' : 'hover:bg-muted/40',
      )}
      data-testid={`clause-row-${c.id}`}
      aria-current={selected ? 'true' : undefined}
    >
      {selectable && (
        <label className="flex w-10 shrink-0 items-start justify-center pt-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={checked}
            onChange={() => onToggleCheck(c.id)}
            aria-label={`Select ${c.clauseRef ?? c.title}`}
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        className={cn(
          'grid min-w-0 flex-1 gap-3 py-2 pr-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          selectable ? 'pl-1' : 'pl-3',
          comfortable
            ? 'grid-cols-[76px_minmax(0,1fr)_minmax(104px,136px)]'
            : 'grid-cols-[64px_minmax(0,1fr)]',
        )}
      >
        <span className="flex flex-col gap-0.5 font-mono text-xs">
          <span className="truncate font-medium text-foreground">
            {c.clauseRef ?? 'No clause no.'}
          </span>
          <span className="text-muted-foreground">
            p.{c.pages.primary}
            {c.pages.supporting.length ? ` +${c.pages.supporting.length}` : ''}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-foreground">{c.title}</span>
          {!comfortable && (
            <span className="truncate text-[11px] text-muted-foreground">
              {REVIEW_LABEL[c.review.status]}
              {c.flags.length ? ` · ${c.flags.map((f) => FLAG_LABEL[f]).join(', ')}` : ''}
            </span>
          )}
          {comfortable && c.summary && (
            <span className="truncate text-xs text-muted-foreground">{c.summary}</span>
          )}
          {comfortable && (
            <span className="flex gap-1 overflow-hidden whitespace-nowrap">
              {type && <Chip>{type}</Chip>}
              {c.stage && <Chip>{STAGE_LABEL[c.stage]}</Chip>}
              {amount && <Chip tone="outline">{amount}</Chip>}
              {chips.map((t) => (
                <Chip key={t} tone="outline">
                  {t}
                </Chip>
              ))}
              {c.disqualifying && <Chip tone="strong">Disqualifying</Chip>}
              {c.flags.slice(0, 2).map((f) => (
                <Chip key={f} tone={flagTone(f)}>
                  {FLAG_LABEL[f]}
                </Chip>
              ))}
              {c.flags.length > 2 && <Chip>+{c.flags.length - 2}</Chip>}
            </span>
          )}
        </span>
        {comfortable && (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <ReviewBadge review={c.review} />
            {(c.review.status === 'UNREVIEWED' || c.review.status === 'NEEDS_REVIEW') && (
              <span className="truncate text-[11px] text-muted-foreground">
                {BAND_LABEL[c.aiBand]}
              </span>
            )}
            {due && comfortable && (
              <span
                className="truncate text-[11px] font-medium tabular-nums text-foreground"
                title="Deadline"
              >
                Due {due}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
};
