/**
 * Documents checklist: the document-type clauses of a tender, grouped by when they are
 * due. Uses the clause workspace's own "Documents to attach" rule so the two never
 * disagree, and only fields the clause states.
 */
import type { Clause, ClauseStage, FulfilmentStatus } from '@tenderpulse/shared-types';
import { PRESETS } from '@/components/clauses/workspaceState.js';
import { STAGE_LABEL } from '@/components/clauses/clauseFormat.js';
import type { ChipTone } from '@/components/clauses/ClauseChips.js';

const isDocument = PRESETS.find((p) => p.id === 'doc')!.test;

/** Submission order: what is due first comes first. */
const STAGE_ORDER: (ClauseStage | 'NOT_STATED')[] = [
  'PRE_BID',
  'WITH_BID_ONLINE',
  'WITH_BID_PHYSICAL',
  'ON_CLARIFICATION',
  'POST_AWARD',
  'EXECUTION',
  'NOT_STATED',
];

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  EVIDENCE_ATTACHED: 'Evidence attached',
  DONE: 'Done',
  AT_RISK: 'At risk',
  NOT_APPLICABLE: 'Not applicable',
};

export const FULFILMENT_TONE: Record<FulfilmentStatus, ChipTone> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'review',
  EVIDENCE_ATTACHED: 'ok',
  DONE: 'amend',
  AT_RISK: 'bad',
  NOT_APPLICABLE: 'outline',
};

export interface ChecklistGroup {
  stage: ClauseStage | 'NOT_STATED';
  label: string;
  rows: Clause[];
  ready: number;
}

/** Ready means the document is done; attached evidence still has to be checked. */
export const isReady = (c: Clause): boolean => c.fulfilment.status === 'DONE';

export function buildChecklist(clauses: Clause[]): {
  groups: ChecklistGroup[];
  total: number;
  ready: number;
} {
  const docs = clauses.filter((c) => isDocument(c) && c.review.status !== 'NOT_A_REQUIREMENT');
  const byStage = new Map<ClauseStage | 'NOT_STATED', Clause[]>();
  for (const c of docs) {
    const key = c.stage ?? 'NOT_STATED';
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  const groups = STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => {
    const rows = byStage.get(stage)!;
    return {
      stage,
      label: stage === 'NOT_STATED' ? 'Stage not stated' : STAGE_LABEL[stage],
      rows,
      ready: rows.filter(isReady).length,
    };
  });
  return { groups, total: docs.length, ready: docs.filter(isReady).length };
}
