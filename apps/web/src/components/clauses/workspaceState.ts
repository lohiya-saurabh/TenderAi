/**
 * Clause workspace view state: saved views (presets), facet filters, search, grouping and
 * selection, all kept in the URL so a view can be shared and survives a reload.
 */
import type {
  AiBand,
  Clause,
  ClauseFlag,
  ClauseStage,
  ReviewStatus,
} from '@tenderpulse/shared-types';

export type PresetId =
  'all' | 'needs' | 'dq' | 'conflict' | 'beforeSub' | 'doc' | 'outside' | 'amended';

export type GroupBy = 'section' | 'task' | 'stage' | 'review' | 'document';
export type Density = 'compact' | 'comfortable';

export interface WorkspaceView {
  preset: PresetId;
  q: string;
  review: ReviewStatus[];
  band: AiBand[];
  flag: ClauseFlag[];
  stage: (ClauseStage | 'NOT_STATED')[];
  group: GroupBy;
  clause: string | null;
  verify: boolean;
  dismissed: boolean;
  density: Density;
}

export const DEFAULT_VIEW: WorkspaceView = {
  preset: 'all',
  q: '',
  review: [],
  band: [],
  flag: [],
  stage: [],
  group: 'section',
  clause: null,
  verify: false,
  dismissed: false,
  density: 'comfortable',
};

const isOpen = (c: Clause) =>
  c.review.status === 'UNREVIEWED' || c.review.status === 'NEEDS_REVIEW';

export const PRESETS: { id: PresetId; label: string; test: (c: Clause) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  {
    id: 'needs',
    label: 'Needs review',
    test: (c) =>
      c.review.status === 'NEEDS_REVIEW' || (isOpen(c) && c.aiBand === 'REVIEW_REQUIRED'),
  },
  { id: 'dq', label: 'Disqualifying if missed', test: (c) => c.disqualifying === true },
  { id: 'conflict', label: 'Conflicts', test: (c) => c.flags.includes('CONFLICT') },
  {
    id: 'beforeSub',
    label: 'Due before submission',
    test: (c) =>
      c.stage === 'PRE_BID' ||
      c.stage === 'WITH_BID_ONLINE' ||
      c.stage === 'WITH_BID_PHYSICAL' ||
      c.deadline?.anchor === 'BID_DUE',
  },
  {
    id: 'doc',
    label: 'Documents to attach',
    test: (c) => c.action === 'ATTACH_DOCUMENT' || c.obligationType === 'DOCUMENT',
  },
  { id: 'outside', label: 'Outside party', test: (c) => c.parties.some((p) => p !== 'BIDDER') },
  { id: 'amended', label: 'Changed by corrigendum', test: (c) => c.flags.includes('AMENDED') },
];

const LIST_KEYS = ['review', 'band', 'flag', 'stage'] as const;

export function parseView(params: URLSearchParams): WorkspaceView {
  const list = <T extends string>(key: string) =>
    (params.get(key) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as T[];
  const preset = params.get('view') as PresetId | null;
  const group = params.get('group') as GroupBy | null;
  return {
    preset: preset && PRESETS.some((p) => p.id === preset) ? preset : 'all',
    q: params.get('q') ?? '',
    review: list<ReviewStatus>('review'),
    band: list<AiBand>('band'),
    flag: list<ClauseFlag>('flag'),
    stage: list<ClauseStage | 'NOT_STATED'>('stage'),
    group:
      group && ['section', 'task', 'stage', 'review', 'document'].includes(group)
        ? group
        : 'section',
    clause: params.get('clause'),
    verify: params.get('verify') === '1',
    dismissed: params.get('dismissed') === '1',
    density: params.get('density') === 'compact' ? 'compact' : 'comfortable',
  };
}

export function serializeView(view: WorkspaceView): URLSearchParams {
  const p = new URLSearchParams();
  if (view.preset !== 'all') p.set('view', view.preset);
  if (view.q) p.set('q', view.q);
  for (const key of LIST_KEYS) if (view[key].length) p.set(key, view[key].join(','));
  if (view.group !== 'section') p.set('group', view.group);
  if (view.clause) p.set('clause', view.clause);
  if (view.verify) p.set('verify', '1');
  if (view.dismissed) p.set('dismissed', '1');
  if (view.density !== 'comfortable') p.set('density', view.density);
  return p;
}

export function activeFilterCount(view: WorkspaceView): number {
  return LIST_KEYS.reduce((n, k) => n + view[k].length, 0) + (view.q ? 1 : 0);
}

function matchesSearch(c: Clause, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [c.title, c.summary, c.quote, c.clauseRef, c.formRef, c.documentName]
    .filter(Boolean)
    .some((s) => (s as string).toLowerCase().includes(needle));
}

/** Clauses visible in a view; `except` skips one facet (for that facet's own counts). */
export function filterClauses(
  clauses: Clause[],
  view: WorkspaceView,
  except?: (typeof LIST_KEYS)[number],
): Clause[] {
  const preset = PRESETS.find((p) => p.id === view.preset) ?? PRESETS[0];
  return clauses.filter((c) => {
    // Dismissed clauses ("not a requirement") stay out of view unless asked for.
    const dismissedHidden = !view.dismissed && !view.review.includes('NOT_A_REQUIREMENT');
    if (dismissedHidden && c.review.status === 'NOT_A_REQUIREMENT') return false;
    if (!preset!.test(c)) return false;
    if (!matchesSearch(c, view.q)) return false;
    if (except !== 'review' && view.review.length && !view.review.includes(c.review.status))
      return false;
    if (except !== 'band' && view.band.length && !view.band.includes(c.aiBand)) return false;
    if (except !== 'flag' && view.flag.length && !view.flag.some((f) => c.flags.includes(f)))
      return false;
    if (except !== 'stage' && view.stage.length && !view.stage.includes(c.stage ?? 'NOT_STATED')) {
      return false;
    }
    return true;
  });
}

export function presetCounts(clauses: Clause[]): Record<PresetId, number> {
  const visible = clauses.filter((c) => c.review.status !== 'NOT_A_REQUIREMENT');
  return Object.fromEntries(
    PRESETS.map((p) => [p.id, p.id === 'all' ? clauses.length : visible.filter(p.test).length]),
  ) as Record<PresetId, number>;
}

/** Section key from the tender's own numbering: "2.1" -> "2", "SCC 7.1" -> "SCC 7", "A1.2" -> "A1". */
export function sectionOf(c: Clause): string {
  const ref = c.clauseRef?.trim();
  if (!ref) return 'Unnumbered clauses';
  const named = ref.match(/^([A-Za-z]+\.?)\s+([A-Za-z]*\d+)/);
  if (named) return `${named[1]} ${named[2]}`;
  const head = ref.match(/^\(?([A-Za-z]*\d+)/);
  if (head) return `Clause ${head[1]}`;
  return ref;
}

export interface ClauseGroup {
  key: string;
  name: string;
  clauses: Clause[];
  needReview: number;
  conflicts: number;
}

const GROUP_NAME: Record<GroupBy, (c: Clause) => string> = {
  section: (c) => `${c.documentName ?? 'Document'} · ${sectionOf(c)}`,
  task: (c) =>
    c.obligationType ? c.obligationType.replace(/_/g, ' ').toLowerCase() : 'type not stated',
  stage: (c) => (c.stage ? c.stage.replace(/_/g, ' ').toLowerCase() : 'stage not stated'),
  review: (c) => c.review.status.replace(/_/g, ' ').toLowerCase(),
  document: (c) => c.documentName ?? 'Document',
};

/** Groups keep the document reading order of their first clause. */
export function groupClauses(clauses: Clause[], group: GroupBy): ClauseGroup[] {
  const groups = new Map<string, ClauseGroup>();
  // The document name only matters when the bid has more than one document.
  const multiDoc = new Set(clauses.map((c) => c.documentId)).size > 1;
  for (const c of clauses) {
    const name = group === 'section' && !multiDoc ? sectionOf(c) : GROUP_NAME[group](c);
    const key = group === 'section' ? `${c.documentId}|${name}` : name;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        clauses: [],
        needReview: 0,
        conflicts: 0,
      };
      groups.set(key, g);
    }
    g.clauses.push(c);
    if (c.review.status === 'NEEDS_REVIEW' || (isOpen(c) && c.aiBand === 'REVIEW_REQUIRED'))
      g.needReview += 1;
    if (c.flags.includes('CONFLICT')) g.conflicts += 1;
  }
  return [...groups.values()];
}

/** Bulk confirm only accepts unreviewed spot-check clauses without flags. */
export function bulkEligible(c: Clause): boolean {
  return c.aiBand === 'SPOT_CHECK' && c.flags.length === 0 && c.review.status === 'UNREVIEWED';
}
