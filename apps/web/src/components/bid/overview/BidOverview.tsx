/**
 * Tender overview: what the tender asks for, what needs attention, money at stake and
 * every deadline, each value linking to the clause it came from. Built only from the
 * bid record and the clause summary; anything the tender does not state says so.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { BidClauseSummary } from '@tenderpulse/shared-types';
import type { BidDetail } from '@/api/bids.js';
import type { BidRecommendation } from '@/components/bid/detail/bidDetailData.js';
import { Chip } from '@/components/clauses/ClauseChips.js';
import { formatAmount, formatDeadline, NOT_STATED } from '@/components/clauses/clauseFormat.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { cn } from '@/lib/utils.js';

const STATUS_LABEL: Record<BidDetail['status'], string> = {
  DRAFT: 'Draft',
  ANALYZING: 'Analysing',
  REVIEW_READY: 'Ready for review',
  SUBMITTED: 'Submitted',
  ARCHIVED: 'Archived',
};

const VERDICT_LABEL: Record<BidRecommendation, string> = {
  PURSUE: 'Pursue',
  DO_NOT_PURSUE: 'Do not pursue',
  REVIEW_REQUIRED: 'Review required',
  RECOMMENDATION_UNAVAILABLE: 'Recommendation unavailable',
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
  testId?: string;
}> = ({ children, className, labelledBy, testId }) => (
  <section
    aria-labelledby={labelledBy}
    data-testid={testId}
    className={cn('rounded-[10px] border border-border bg-card', className)}
  >
    {children}
  </section>
);

/** Clause reference chip ("2.11.1 · p.14") that opens the clause in the workspace. */
export const RefLink: React.FC<{
  bidId: string;
  clauseId: string;
  clauseRef: string | null;
  page: number;
  className?: string;
}> = ({ bidId, clauseId, clauseRef, page, className }) => (
  <Link
    to={`/bids/${encodeURIComponent(bidId)}/clauses?clause=${encodeURIComponent(clauseId)}`}
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-md border border-border bg-[#F1F3F6] px-[7px] py-px font-mono text-[11.5px] text-[#2B313C] no-underline hover:border-primary hover:text-primary dark:bg-white/5 dark:text-white/80',
      className,
    )}
  >
    {clauseRef ?? 'No clause no.'} · {page > 0 ? `p.${page}` : 'no page'}
  </Link>
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

/** "in 14 days" only when the tender date is unambiguous ISO; never a guess. */
function relativeDays(date: string | null, today = new Date()): string | null {
  if (!date || !ISO_DATE.test(date)) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} days ago`;
}

function formatBidDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const BidOverviewHeader: React.FC<{
  bid: BidDetail;
  summary: BidClauseSummary | null;
  actions: React.ReactNode;
}> = ({ bid, summary, actions }) => {
  const hasCorrigendum = bid.documents.some((d) => d.documentType === 'CORRIGENDUM');
  const r = summary?.review;
  const total = summary?.clauses ?? 0;
  const reviewed = r ? r.CONFIRMED + r.CORRECTED + r.NOT_A_REQUIREMENT : 0;
  const needs = r?.NEEDS_REVIEW ?? 0;
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%');
  const docCount = bid.documents.length;

  return (
    <Card className="flex flex-col gap-3.5 px-[22px] py-5" labelledBy="tender-title">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Chip tone="neutral">{STATUS_LABEL[bid.status]}</Chip>
            {bid.locationState && <Chip tone="neutral">{bid.locationState}</Chip>}
            {hasCorrigendum && <Chip tone="amend">Corrigendum in package</Chip>}
          </div>
          <h1 id="tender-title" className="m-0 text-[22px] font-bold tracking-[-0.01em]">
            {bid.title}
          </h1>
          <p className="m-0 text-[13px] text-muted-foreground">
            {bid.tenderingAuthority || 'Authority not stated'} · Tender ID{' '}
            <span className="font-mono text-xs">{bid.tenderNumber || NOT_STATED}</span> · {docCount}{' '}
            document{docCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-auto flex-wrap justify-end gap-2">{actions}</div>
      </div>

      {summary && total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-3 text-[13px]">
            <span>
              <strong className="tabular-nums">
                {reviewed} of {total}
              </strong>{' '}
              clauses reviewed · <strong className="tabular-nums">{needs}</strong> need review ·{' '}
              <strong className="tabular-nums">{summary.conflicts.unresolved}</strong> unresolved
              conflict{summary.conflicts.unresolved === 1 ? '' : 's'}
            </span>
            {summary.pagesNotAnalysed > 0 && (
              <Chip tone="warn">
                {summary.pagesNotAnalysed} page{summary.pagesNotAnalysed === 1 ? '' : 's'} not
                analysed — clauses on {summary.pagesNotAnalysed === 1 ? 'it' : 'them'} are missing
              </Chip>
            )}
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-[#EEF0F3] dark:bg-white/10"
            role="img"
            aria-label={`${reviewed} of ${total} clauses reviewed, ${needs} need review`}
          >
            <div className="bg-primary" style={{ width: pct(reviewed) }} />
            <div className="bg-[#E08A1E]" style={{ width: pct(needs) }} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendSwatch className="bg-primary">Reviewed</LegendSwatch>
            <LegendSwatch className="bg-[#E08A1E]">Needs review</LegendSwatch>
            <LegendSwatch className="border border-[#C9D0DA] bg-[#EEF0F3] dark:bg-white/10">
              Unreviewed AI readings
            </LegendSwatch>
          </div>
        </div>
      )}
    </Card>
  );
};

const LegendSwatch: React.FC<{ className: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <span className="inline-flex items-center">
    <span className={cn('mr-1.5 inline-block h-2 w-2 rounded-[2px]', className)} />
    {children}
  </span>
);

export const KeyFacts: React.FC<{ bid: BidDetail; verdict: BidRecommendation | null }> = ({
  bid,
  verdict,
}) => {
  const deadline = formatBidDate(bid.submissionDeadline);
  const facts: { k: string; v: string; notStated?: boolean; mono?: boolean }[] = [
    {
      k: 'Tendering authority',
      v: bid.tenderingAuthority || NOT_STATED,
      notStated: !bid.tenderingAuthority,
    },
    {
      k: 'Tender ID',
      v: bid.tenderNumber || NOT_STATED,
      notStated: !bid.tenderNumber,
      mono: true,
    },
    {
      k: 'Estimated value',
      v: bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : NOT_STATED,
      notStated: !bid.estimatedValueRupees,
    },
    { k: 'Submission deadline', v: deadline ?? NOT_STATED, notStated: !deadline },
    { k: 'Location', v: bid.locationState || NOT_STATED, notStated: !bid.locationState },
    {
      k: 'Eligibility verdict',
      v: verdict ? VERDICT_LABEL[verdict] : 'Not evaluated yet',
      notStated: !verdict,
    },
  ];

  return (
    <Card
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 px-5 py-[18px]"
      labelledBy="facts-h"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="facts-h" className="m-0 text-base font-bold">
          Key facts
        </h2>
        <span className="text-xs text-muted-foreground">Entered when the bid was set up</span>
      </div>
      <dl className="m-0 flex flex-col text-sm">
        {facts.map((f) => (
          <div
            key={f.k}
            className="flex flex-wrap items-baseline gap-3 border-t border-[#EEF0F3] py-[9px] dark:border-white/10"
          >
            <dt className="flex-[0_0_200px] text-[13px] font-medium text-[#3D4452] dark:text-white/70">
              {f.k}
            </dt>
            <dd
              className={cn(
                'm-0 min-w-0 flex-[1_1_260px] tabular-nums',
                f.notStated && 'italic text-muted-foreground',
                f.mono && !f.notStated && 'font-mono text-xs',
              )}
            >
              {f.v}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};

export const AttentionTiles: React.FC<{ bidId: string; summary: BidClauseSummary }> = ({
  bidId,
  summary,
}) => {
  const ws = (q: string) => `/bids/${encodeURIComponent(bidId)}/clauses?${q}`;
  const a = summary.attention;
  const tiles = [
    {
      n: a.conflicts,
      label: 'Conflicts',
      hint: 'Same item, different values',
      to: ws('view=conflict'),
      color: 'text-[#9F1C1C] dark:text-red-300',
    },
    {
      n: a.pagesNotAnalysed,
      label: 'Pages not analysed',
      hint: 'Read these pages manually',
      to: ws('verify=1'),
      color: 'text-[#6E4B00] dark:text-amber-300',
    },
    {
      n: a.disqualifyingUnreviewed,
      label: 'Disqualifying, unreviewed',
      hint: 'Rejected if missed',
      to: ws('view=dq'),
      color: 'text-[#8A4200] dark:text-orange-300',
    },
    {
      n: a.quoteNotFound,
      label: 'Quote not found',
      hint: 'AI quote not in page text',
      to: ws('flag=QUOTE_NOT_FOUND'),
      color: 'text-[#9F1C1C] dark:text-red-300',
    },
    {
      n: a.needsOutsideParty,
      label: 'Need an outside party',
      hint: 'CA, notary, bank, past client',
      to: ws('view=outside'),
      color: 'text-[#1C3DA8] dark:text-blue-300',
    },
    {
      n: summary.review.NEEDS_REVIEW,
      label: 'Marked needs review',
      hint: 'Flagged by your team',
      to: ws('view=needs'),
      color: 'text-[#8A4200] dark:text-orange-300',
    },
  ];

  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]" labelledBy="att-h" testId="clause-entry">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="att-h" className="m-0 text-base font-bold">
          Needs your attention
        </h2>
        <span className="text-xs text-muted-foreground">
          {summary.clauses} clauses from {summary.documents} document
          {summary.documents === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            data-testid="attention-tile"
            className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-border bg-card p-3.5 text-foreground no-underline hover:border-primary"
          >
            <span
              className={cn(
                'text-[26px] font-bold tabular-nums',
                t.n > 0 ? t.color : 'text-muted-foreground',
              )}
            >
              {t.n}
            </span>
            <span className="text-[13px] font-semibold">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
};

export const MoneyAtStake: React.FC<{ bidId: string; summary: BidClauseSummary }> = ({
  bidId,
  summary,
}) => (
  <Card className="flex flex-col gap-2.5 px-5 py-[18px]" labelledBy="money-h">
    <h2 id="money-h" className="m-0 text-base font-bold">
      Money at stake
    </h2>
    {summary.amounts.length === 0 ? (
      <p className="m-0 text-[13px] italic text-muted-foreground">
        No amounts stated in the analysed clauses.
      </p>
    ) : (
      summary.amounts.map((m) => (
        <div
          key={m.clauseId}
          className="flex items-baseline gap-3 border-t border-[#EEF0F3] py-1.5 dark:border-white/10"
        >
          <span className="flex min-w-0 flex-auto flex-wrap items-baseline gap-2 text-[13px]">
            {m.title}
            <RefLink bidId={bidId} clauseId={m.clauseId} clauseRef={m.clauseRef} page={m.page} />
          </span>
          <span className="whitespace-nowrap text-right font-semibold tabular-nums">
            {formatAmount(m.amount)}
          </span>
        </div>
      ))
    )}
  </Card>
);

export const DeadlineTimeline: React.FC<{ bidId: string; summary: BidClauseSummary }> = ({
  bidId,
  summary,
}) => {
  const absolute = summary.deadlines.filter((d) => d.deadline.kind === 'ABSOLUTE');
  const relative = summary.deadlines.filter((d) => d.deadline.kind === 'RELATIVE');

  return (
    <Card className="flex flex-col gap-3.5 px-5 py-[18px]" labelledBy="dl-h">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="dl-h" className="m-0 text-base font-bold">
          Deadlines
        </h2>
        <span className="text-xs text-muted-foreground">
          Dates as written in the tender · each links to its clause
        </span>
      </div>
      {summary.deadlines.length === 0 ? (
        <p className="m-0 text-[13px] italic text-muted-foreground">
          No deadlines stated in the analysed clauses.
        </p>
      ) : (
        <>
          {absolute.length > 0 && (
            <div className="overflow-x-auto">
              <ol
                className="m-0 flex list-none p-0"
                style={{ minWidth: `${Math.max(absolute.length, 4) * 180}px` }}
              >
                {absolute.map((d) => {
                  const rel = relativeDays(d.deadline.date);
                  return (
                    <li key={d.clauseId} className="flex min-w-0 flex-1 flex-col gap-1.5 pr-2.5">
                      <div className="flex items-center" aria-hidden="true">
                        <span className="h-3 w-3 flex-none rounded-full border-2 border-primary bg-card" />
                        <span className="h-0.5 flex-auto bg-[#C9D0DA] dark:bg-white/20" />
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        {formatDeadline(d.deadline)}
                      </span>
                      <span className="text-[13px] font-medium">{d.title}</span>
                      {rel && <span className="text-xs text-muted-foreground">{rel}</span>}
                      <RefLink
                        bidId={bidId}
                        clauseId={d.clauseId}
                        clauseRef={d.clauseRef}
                        page={d.page}
                        className="self-start"
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {relative.length > 0 && (
            <div className="flex flex-wrap gap-2.5 border-t border-dashed border-[#C9D0DA] pt-3 dark:border-white/20">
              <span className="self-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Relative to an event
              </span>
              {relative.map((d) => (
                <Link
                  key={d.clauseId}
                  to={`/bids/${encodeURIComponent(bidId)}/clauses?clause=${encodeURIComponent(d.clauseId)}`}
                  className="no-underline"
                >
                  <Chip tone="outline">
                    {d.title} · {formatDeadline(d.deadline)}
                  </Chip>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
};
