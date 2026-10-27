/**
 * Documents checklist & coverage: what must be submitted, grouped by when it is due, and
 * which pages the AI could and could not read. Status comes from the clause record;
 * fields a clause does not state are shown as not stated, never guessed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Clause, Coverage, CoverageStatus } from '@tenderpulse/shared-types';
import { getCoverage, listClauses } from '@/api/clauses.js';
import { getBid } from '@/api/bids.js';
import { Chip } from '@/components/clauses/ClauseChips.js';
import {
  PARTY_LABEL,
  REVIEW_LABEL,
  attestationChips,
  formatDeadline,
} from '@/components/clauses/clauseFormat.js';
import { Card, RefLink } from '@/components/bid/overview/BidOverview.js';
import {
  FULFILMENT_LABEL,
  FULFILMENT_TONE,
  buildChecklist,
} from '@/components/checklist/checklistData.js';
import { useSetBidBreadcrumbTitle } from '@/components/layout/BreadcrumbTitle.js';
import { cn } from '@/lib/utils.js';

type Tab = 'checklist' | 'coverage';

const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  COMPLETE: 'all analysed',
  PARTIAL: 'partly analysed',
  RUNNING: 'analysis running',
  FAILED: 'analysis failed',
  NOT_ANALYSED: 'not analysed',
  UNKNOWN: 'page coverage not recorded',
};

const FAILURE_REASON: Record<string, string> = {
  LLM_EXTRACTION_FAILED: 'AI could not read it',
};

/** Readable page-failure reason; unknown codes become plain words. */
const failureReason = (code: string): string =>
  FAILURE_REASON[code] ?? code.toLowerCase().replace(/_/g, ' ');

const GRID =
  'grid grid-cols-[minmax(0,2.2fr)_90px_minmax(0,1.3fr)_minmax(0,1.1fr)_120px_minmax(0,1.2fr)] gap-3 px-3.5';

export const ChecklistPage: React.FC = () => {
  const { id: bidId = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'coverage' ? 'coverage' : 'checklist';

  const [clauses, setClauses] = useState<Clause[] | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bidTitle, setBidTitle] = useState<string | null>(null);
  useSetBidBreadcrumbTitle(bidId, bidTitle);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listClauses(bidId), getCoverage(bidId), getBid(bidId)]).then(
      ([cl, cov, bid]) => {
        if (cancelled) return;
        if (cl.ok) setClauses(cl.data.clauses);
        else setError(cl.error.message);
        if (cov.ok) setCoverage(cov.data);
        if (bid.ok) setBidTitle(bid.data.title);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bidId]);

  const checklist = useMemo(() => buildChecklist(clauses ?? []), [clauses]);
  const failedPages =
    coverage?.documents.flatMap((d) => d.failedPages.map((p) => ({ doc: d, ...p }))) ?? [];

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === 'coverage') p.set('tab', 'coverage');
    else p.delete('tab');
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold">
            Documents to submit
            {clauses && ` · ${checklist.ready} of ${checklist.total} ready`}
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted-foreground">
            Built from document-type clauses, grouped by when they are due. Attestation shows only
            what the tender asks for.
          </p>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Checklist views">
          {(['checklist', 'coverage'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={cn(
                'min-h-9 rounded-lg px-3 text-[13px] font-medium',
                tab === t
                  ? 'bg-[#16191F] text-white dark:bg-white dark:text-[#16191F]'
                  : 'text-[#3D4452] hover:bg-muted dark:text-white/75',
              )}
            >
              {t === 'checklist' ? 'Checklist' : 'Coverage'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      {!clauses && !error && <p className="m-0 text-sm text-muted-foreground">Loading…</p>}

      {clauses && tab === 'checklist' && (
        <Card className="overflow-hidden" testId="checklist">
          <div id="panel-checklist" role="tabpanel" aria-label="Checklist">
            {checklist.total === 0 ? (
              <p className="m-0 p-5 text-[13px] italic text-muted-foreground">
                No document-type clauses in the analysed pages.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div
                    className={cn(
                      GRID,
                      'border-b border-border py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                    )}
                  >
                    <span>Document</span>
                    <span>Form</span>
                    <span>Attestation</span>
                    <span>Party</span>
                    <span>Due</span>
                    <span>Status</span>
                  </div>
                  {checklist.groups.map((g) => (
                    <div key={g.stage} data-testid="checklist-group">
                      <div className="border-b border-border bg-[#F1F3F6] px-3.5 py-2 text-[12.5px] dark:bg-white/5">
                        <strong>{g.label}</strong>{' '}
                        <span className="text-muted-foreground">
                          · {g.ready} of {g.rows.length} ready
                        </span>
                      </div>
                      {g.rows.map((c) => (
                        <ChecklistRow key={c.id} bidId={bidId} clause={c} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {clauses && tab === 'coverage' && (
        <Card className="flex flex-col gap-3.5 px-5 py-[18px]" testId="coverage">
          <div id="panel-coverage" role="tabpanel" aria-label="Coverage" className="contents">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 text-base font-bold">Coverage · what the AI read</h2>
              <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[2px] bg-[#E3E6EB] dark:bg-white/20" />
                  Analysed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-[2px] bg-[#C62828]" />
                  Not analysed
                </span>
              </div>
            </div>

            {failedPages.length > 0 && (
              <div
                className="rounded-lg border border-[#EBD27A] bg-[#FFF7D6] px-3 py-2.5 text-[13px] text-[#4A3500] dark:bg-amber-500/10 dark:text-amber-200"
                data-testid="coverage-warning"
              >
                TenderPulse could not read {failedPages.length} page
                {failedPages.length === 1 ? '' : 's'} (
                {failedPages
                  .map((p) => `${p.doc.name} p.${p.page} · ${failureReason(p.reason)}`)
                  .join('; ')}
                ). Requirements on {failedPages.length === 1 ? 'it' : 'them'} are not in the clause
                list.{' '}
                <Link
                  to={`/bids/${encodeURIComponent(bidId)}/clauses?verify=1`}
                  className="font-semibold text-primary underline"
                >
                  Read in the verify layout
                </Link>
              </div>
            )}

            {!coverage || coverage.documents.length === 0 ? (
              <p className="m-0 text-[13px] italic text-muted-foreground">
                No coverage recorded for this bid.
              </p>
            ) : (
              coverage.documents.map((d) => {
                const failed = new Set(d.failedPages.map((p) => p.page));
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-start gap-4 border-t border-[#EEF0F3] pt-2.5 dark:border-white/10"
                  >
                    <div className="flex flex-[0_0_260px] flex-col gap-0.5">
                      <strong className="text-[13px] break-words">{d.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {d.pageCount != null ? `${d.pageCount} pages · ` : ''}
                        {d.failedPages.length > 0
                          ? `${d.failedPages.length} not analysed`
                          : COVERAGE_LABEL[d.status]}
                      </span>
                    </div>
                    {d.pageCount != null && d.pageCount > 0 ? (
                      <div
                        className="flex flex-[1_1_400px] flex-wrap gap-[3px]"
                        role="img"
                        aria-label={`${d.name}: ${d.pageCount - failed.size} of ${d.pageCount} pages analysed`}
                      >
                        {Array.from({ length: d.pageCount }, (_, i) => (
                          <span
                            key={i}
                            title={`p.${i + 1}${failed.has(i + 1) ? ' · not analysed' : ''}`}
                            className={cn(
                              'h-3 w-3 rounded-[2px]',
                              failed.has(i + 1) ? 'bg-[#C62828]' : 'bg-[#E3E6EB] dark:bg-white/20',
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        Page count not recorded
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

const ChecklistRow: React.FC<{ bidId: string; clause: Clause }> = ({ bidId, clause: c }) => {
  const attest = attestationChips(c);
  const parties = c.parties.map((p) => PARTY_LABEL[p]).join(' · ');
  return (
    <div
      className={cn(
        GRID,
        'items-start border-b border-[#EEF0F3] py-2.5 text-[13px] dark:border-white/10',
      )}
      data-testid="checklist-row"
    >
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="font-semibold">{c.title}</span>
        <RefLink bidId={bidId} clauseId={c.id} clauseRef={c.clauseRef} page={c.pages.primary} />
      </span>
      <span className={cn('font-mono text-xs', !c.formRef && 'italic text-muted-foreground')}>
        {c.formRef ?? '—'}
      </span>
      <span className="flex flex-wrap items-start gap-1">
        {attest.length > 0 ? (
          attest.map((a) => (
            <Chip key={a} tone="outline">
              {a}
            </Chip>
          ))
        ) : (
          <span className="text-muted-foreground">None stated</span>
        )}
      </span>
      <span className={cn(!parties && 'italic text-muted-foreground')}>
        {parties || 'Not stated'}
      </span>
      <span className={cn(!c.deadline && 'italic text-muted-foreground')}>
        {formatDeadline(c.deadline)}
      </span>
      <span className="flex flex-col items-start gap-1">
        <Chip tone={FULFILMENT_TONE[c.fulfilment.status]}>
          {FULFILMENT_LABEL[c.fulfilment.status]}
        </Chip>
        <span className="text-xs text-muted-foreground">
          Clause {REVIEW_LABEL[c.review.status].toLowerCase()}
        </span>
      </span>
    </div>
  );
};
