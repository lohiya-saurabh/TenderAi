import React from 'react';
import type {
  AiBand,
  Clause,
  ClauseFlag,
  ClauseStage,
  ReviewStatus,
} from '@tenderpulse/shared-types';
import { BAND_LABEL, FLAG_LABEL, REVIEW_LABEL, STAGE_LABEL } from './clauseFormat.js';
import { filterClauses, type WorkspaceView } from './workspaceState.js';

type FacetKey = 'review' | 'band' | 'flag' | 'stage';

const FACETS: { key: FacetKey; title: string; options: [string, string][] }[] = [
  {
    key: 'review',
    title: 'Review',
    options: (Object.keys(REVIEW_LABEL) as ReviewStatus[]).map((k) => [k, REVIEW_LABEL[k]]),
  },
  {
    key: 'flag',
    title: 'Flags',
    options: (Object.keys(FLAG_LABEL) as ClauseFlag[]).map((k) => [k, FLAG_LABEL[k]]),
  },
  {
    key: 'band',
    title: 'AI reading',
    options: (Object.keys(BAND_LABEL) as AiBand[]).map((k) => [
      k,
      BAND_LABEL[k].replace('AI · ', ''),
    ]),
  },
  {
    key: 'stage',
    title: 'Stage',
    options: [
      ...(Object.keys(STAGE_LABEL) as ClauseStage[]).map((k): [string, string] => [
        k,
        STAGE_LABEL[k],
      ]),
      ['NOT_STATED', 'Not stated'],
    ],
  },
];

function valueOf(c: Clause, key: FacetKey): string[] {
  switch (key) {
    case 'review':
      return [c.review.status];
    case 'band':
      return [c.aiBand];
    case 'flag':
      return c.flags;
    case 'stage':
      return [c.stage ?? 'NOT_STATED'];
  }
}

export const ClauseFilters: React.FC<{
  clauses: Clause[];
  view: WorkspaceView;
  onChange: (patch: Partial<WorkspaceView>) => void;
}> = ({ clauses, view, onChange }) => {
  const toggle = (key: FacetKey, value: string) => {
    const current = view[key] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ [key]: next } as Partial<WorkspaceView>);
  };
  const anyActive = FACETS.some((f) => view[f.key].length > 0);

  return (
    <nav
      aria-label="Filters"
      className="flex h-full flex-col overflow-y-auto rounded-lg border border-border bg-card px-3 py-2 text-sm"
    >
      <div className="flex items-center justify-between py-1">
        <span className="font-semibold">Filters</span>
        {anyActive && (
          <button
            type="button"
            className="min-h-6 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => onChange({ review: [], band: [], flag: [], stage: [] })}
          >
            Clear
          </button>
        )}
      </div>
      {FACETS.map((facet) => {
        // Counts for a facet ignore that facet's own selection (standard faceted search).
        const base = filterClauses(clauses, view, facet.key);
        const counts = new Map<string, number>();
        for (const c of base)
          for (const v of valueOf(c, facet.key)) counts.set(v, (counts.get(v) ?? 0) + 1);
        const options = facet.options.filter(
          ([value]) =>
            (counts.get(value) ?? 0) > 0 || (view[facet.key] as string[]).includes(value),
        );
        if (options.length === 0) return null;
        return (
          <fieldset key={facet.key} className="border-t border-border py-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {facet.title}
            </legend>
            {options.map(([value, label]) => (
              <label key={value} className="flex min-h-7 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={(view[facet.key] as string[]).includes(value)}
                  onChange={() => toggle(facet.key, value)}
                />
                <span className="flex-1">{label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {counts.get(value) ?? 0}
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
      <label className="mt-1 flex min-h-7 cursor-pointer items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={view.dismissed}
          onChange={() => onChange({ dismissed: !view.dismissed })}
        />
        Show clauses marked “not a requirement”
      </label>
    </nav>
  );
};
