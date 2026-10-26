/**
 * Non-modal clause panel: source text first, then the AI summary, the stated requirement
 * details, any conflict, the activity history and the review actions. Only populated
 * sections render; what the clause does not state is listed on one line.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ClauseDetail,
  ClauseReviewRequest,
  ClauseStage,
  ObligationType,
  ReviewAction,
} from '@tenderpulse/shared-types';
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  BAND_LABEL,
  FLAG_LABEL,
  OBLIGATION_LABEL,
  PARTY_LABEL,
  QUOTE_CHECK_LABEL,
  STAGE_LABEL,
  ACTION_LABEL,
  attestationChips,
  formatAmount,
  formatDeadline,
  notStatedFields,
} from './clauseFormat.js';
import { Chip, ReviewBadge, flagTone } from './ClauseChips.js';

export interface ClausePanelProps {
  bidId: string;
  clause: ClauseDetail | null;
  loading: boolean;
  canReview: boolean;
  sourceOpened: boolean;
  /** Inline source viewer (triage layout) or null when the viewer has its own column */
  sourceSlot: React.ReactNode | null;
  onOpenSource: () => void;
  onReview: (action: ReviewAction, extra?: Partial<ClauseReviewRequest>) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  correcting: boolean;
  onCorrecting: (on: boolean) => void;
  busy: boolean;
}

export const ClausePanel: React.FC<ClausePanelProps> = ({
  bidId,
  clause: c,
  loading,
  canReview,
  sourceOpened,
  sourceSlot,
  onOpenSource,
  onReview,
  onPrev,
  onNext,
  onClose,
  correcting,
  onCorrecting,
  busy,
}) => {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [c?.id]);

  if (!c) {
    return (
      <aside
        className="flex h-full items-center justify-center rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground"
        aria-label="Clause details"
      >
        {loading ? 'Loading clause…' : 'Select a clause to see its source text and details.'}
      </aside>
    );
  }

  const open = c.review.status === 'UNREVIEWED' || c.review.status === 'NEEDS_REVIEW';
  const unresolved = c.conflicts.filter((x) => x.resolution === 'UNRESOLVED');
  const needsSource = c.aiBand !== 'SPOT_CHECK' || c.disqualifying === true || c.flags.length > 0;
  const confirmLocked = needsSource && !sourceOpened;
  const quoteMissing = c.quoteCheck === 'NOT_FOUND';
  const details = detailRows(c);
  const notStated = notStatedFields(c);

  return (
    <aside
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card"
      aria-label="Clause details"
      data-testid="clause-panel"
    >
      <header className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{c.clauseRef ?? 'No clause no.'}</span>
          <span className="truncate text-xs text-muted-foreground">
            {c.documentName ?? 'Tender document'} · p.{c.pages.primary}
            {c.pages.supporting.length ? ` (also p.${c.pages.supporting.join(', ')})` : ''}
          </span>
          <span className="ml-auto flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onPrev}
              aria-label="Previous clause (K)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onNext}
              aria-label="Next clause (J)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug text-foreground">{c.title}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <ReviewBadge review={c.review} />
          {open && <span className="text-xs text-muted-foreground">{BAND_LABEL[c.aiBand]}</span>}
          {c.disqualifying && <Chip tone="strong">Disqualifying</Chip>}
          {c.flags.map((f) => (
            <Chip key={f} tone={flagTone(f)}>
              {FLAG_LABEL[f]}
            </Chip>
          ))}
        </div>
        {open && (
          <p className="text-xs text-muted-foreground">
            AI-extracted: verify against the source before confirming.
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {c.conflicts.length > 0 && (
          <section aria-label="Conflict" className="space-y-2" data-testid="panel-conflict">
            {c.conflicts.map((cf) => (
              <div key={cf.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive">
                    Conflict · {cf.attribute}
                  </span>
                  <Chip tone={cf.resolution === 'UNRESOLVED' ? 'bad' : 'ok'}>
                    {cf.resolution === 'UNRESOLVED'
                      ? 'Unresolved'
                      : cf.resolution.replace(/_/g, ' ').toLowerCase()}
                  </Chip>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cf.values.map((v) => (
                    <div
                      key={v.clauseId}
                      className={`space-y-1 rounded-md border p-2 ${v.clauseId === c.id ? 'border-foreground' : 'border-border'}`}
                    >
                      <div className="text-sm font-semibold tabular-nums">{v.display}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {v.clauseRef ?? 'No clause no.'} · p.{v.page}
                      </div>
                      <div className="font-serif text-xs text-foreground/80">“{v.quote}”</div>
                    </div>
                  ))}
                </div>
                {cf.aiPrecedenceNote && (
                  <div className="rounded-md bg-violet-500/10 p-2 text-xs">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      AI suggestion — not tender text
                    </div>
                    {cf.aiPrecedenceNote}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        <section aria-label="Source text" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source text · verbatim
            </span>
            <Chip tone={quoteMissing ? 'bad' : c.quoteCheck === 'NO_PAGE_TEXT' ? 'neutral' : 'ok'}>
              {QUOTE_CHECK_LABEL(c.quoteCheck, c.pages.primary)}
            </Chip>
          </div>
          {c.context?.before && (
            <p className="line-clamp-3 font-serif text-xs text-muted-foreground">
              {c.context.before}
            </p>
          )}
          <blockquote
            className={`m-0 rounded-lg border px-[11px] py-[9px] font-serif text-[13.5px] leading-[1.5] text-[#22262E] dark:text-white/85 ${sourceOpened ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10' : 'border-[var(--quote-border)] bg-[var(--quote-bg)]'}`}
            data-testid="panel-quote"
          >
            {c.quote}
          </blockquote>
          {c.context?.after && (
            <p className="line-clamp-3 font-serif text-xs text-muted-foreground">
              {c.context.after}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {sourceSlot === null ? null : (
              <Button variant="outline" size="sm" onClick={onOpenSource} data-testid="open-source">
                Open in source (O)
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigator.clipboard?.writeText(c.quote)}
              aria-label="Copy quote"
            >
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
            {sourceOpened && <Chip tone="ok">Source viewed on p.{c.pages.primary}</Chip>}
          </div>
          {sourceSlot && <div className="h-80">{sourceSlot}</div>}
        </section>

        {c.summary && (
          <section aria-label="AI summary" className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              AI summary
            </span>
            <p className="text-sm text-foreground">{c.summary}</p>
          </section>
        )}

        {correcting && canReview ? (
          <CorrectForm
            clause={c}
            busy={busy}
            onCancel={() => onCorrecting(false)}
            onSave={(corrections, n) => onReview('CORRECT', { corrections, note: n || undefined })}
          />
        ) : (
          <section aria-label="Requirement details">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Requirement details
            </span>
            {details.length > 0 ? (
              <dl className="mt-1 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-t border-border py-1.5">
                    <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 flex-1">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                The clause states no task details.
              </p>
            )}
            {notStated.length > 0 && (
              <p
                className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground"
                data-testid="not-stated"
              >
                Not stated in this clause: {notStated.join(', ')}
              </p>
            )}
          </section>
        )}

        <section aria-label="Activity" className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </span>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {c.history.map((h, i) => (
              <li key={i}>{historyLine(h)}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="space-y-2 border-t border-border bg-muted/30 px-4 py-3">
        {!canReview ? (
          <p className="text-xs text-muted-foreground" data-testid="read-only-note">
            You can view but not review. Ask a bid manager for review access.
          </p>
        ) : unresolved.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link to={`/bids/${bidId}/conflicts#${unresolved[0]!.id}`}>Resolve the conflict</Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              Accept one value or raise a pre-bid query before confirming this clause.
            </span>
          </div>
        ) : (
          <>
            {quoteMissing && c.review.status !== 'CONFIRMED' && (
              <input
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                placeholder="Why confirm although the quote was not found? (required)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Confirmation note"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                data-testid="review-confirm"
                disabled={
                  busy ||
                  confirmLocked ||
                  c.review.status === 'CONFIRMED' ||
                  (quoteMissing && !note.trim())
                }
                onClick={() => onReview('CONFIRM', { note: note || undefined })}
              >
                Confirm (A)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onCorrecting(true)}
                data-testid="review-correct"
              >
                Correct (E)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onReview('NOT_A_REQUIREMENT')}
              >
                Not a requirement (R)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || c.review.status === 'NEEDS_REVIEW'}
                onClick={() => onReview('NEEDS_REVIEW')}
              >
                Needs review
              </Button>
            </div>
            {confirmLocked && c.review.status !== 'CONFIRMED' && (
              <p
                className="text-xs text-orange-700 dark:text-orange-300"
                data-testid="confirm-hint"
              >
                Open the source to confirm: this clause{' '}
                {c.disqualifying
                  ? 'is disqualifying'
                  : c.flags.length
                    ? 'is flagged'
                    : 'is not a clean spot-check'}
                .
              </p>
            )}
          </>
        )}
      </footer>
    </aside>
  );
};

function detailRows(c: ClauseDetail): [string, string][] {
  const rows: [string, string][] = [];
  if (c.obligationType) rows.push(['Obligation', OBLIGATION_LABEL[c.obligationType]]);
  if (c.action) rows.push(['Action', ACTION_LABEL[c.action]]);
  if (c.stage) rows.push(['Stage', STAGE_LABEL[c.stage]]);
  if (c.parties.length) rows.push(['Parties', c.parties.map((p) => PARTY_LABEL[p]).join(' · ')]);
  if (c.deadline) rows.push(['Deadline', formatDeadline(c.deadline)]);
  if (c.amount) rows.push(['Amount', formatAmount(c.amount)]);
  if (c.formRef) rows.push(['Form', c.formRef]);
  const att = attestationChips(c);
  if (att.length) rows.push(['Attestation', att.join(' · ')]);
  if (c.mandatory)
    rows.push(['Mandatory', c.mandatory === 'MANDATORY' ? 'Mandatory' : 'Desirable']);
  return rows;
}

const TIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function historyLine(h: ClauseDetail['history'][number]): string {
  const at = TIME.format(new Date(h.at));
  if (h.kind === 'AI_EXTRACTED') return `AI extracted · ${at}`;
  const to = String(h.detail.to ?? '')
    .replace(/_/g, ' ')
    .toLowerCase();
  const note = h.detail.note ? ` · “${String(h.detail.note)}”` : '';
  const diff = h.detail.diff ? ` · changed ${Object.keys(h.detail.diff as object).join(', ')}` : '';
  return `${h.by?.name ?? 'System'} · ${to || h.kind.toLowerCase()} · ${at}${diff}${note}`;
}

const STAGES = Object.keys(STAGE_LABEL) as ClauseStage[];
const OBLIGATIONS = Object.keys(OBLIGATION_LABEL) as ObligationType[];

const CorrectForm: React.FC<{
  clause: ClauseDetail;
  busy: boolean;
  onCancel: () => void;
  onSave: (corrections: NonNullable<ClauseReviewRequest['corrections']>, note: string) => void;
}> = ({ clause: c, busy, onCancel, onSave }) => {
  const [title, setTitle] = useState(c.title);
  const [summary, setSummary] = useState(c.summary ?? '');
  const [clauseRef, setClauseRef] = useState(c.clauseRef ?? '');
  const [stage, setStage] = useState<string>(c.stage ?? '');
  const [obligation, setObligation] = useState<string>(c.obligationType ?? '');
  const [mandatory, setMandatory] = useState<string>(c.mandatory ?? '');
  const [amountInr, setAmountInr] = useState(c.amount?.inr != null ? String(c.amount.inr) : '');
  const [percent, setPercent] = useState(c.amount?.percent != null ? String(c.amount.percent) : '');
  const [note, setNote] = useState('');

  const save = () => {
    const corrections: NonNullable<ClauseReviewRequest['corrections']> = {};
    if (title.trim() !== c.title) corrections.title = title.trim();
    if (summary !== (c.summary ?? '')) corrections.summary = summary;
    if ((clauseRef.trim() || null) !== c.clauseRef)
      corrections.clauseRef = clauseRef.trim() || null;
    if ((stage || null) !== c.stage) corrections.stage = (stage || null) as ClauseStage | null;
    if ((obligation || null) !== c.obligationType) {
      corrections.obligationType = (obligation || null) as ObligationType | null;
    }
    if ((mandatory || null) !== c.mandatory) {
      corrections.mandatory = (mandatory || null) as 'MANDATORY' | 'DESIRABLE' | null;
    }
    const inr = amountInr.trim() ? Number(amountInr) : null;
    const pct = percent.trim() ? Number(percent) : null;
    if (inr !== (c.amount?.inr ?? null) || pct !== (c.amount?.percent ?? null)) {
      corrections.amount =
        inr == null && pct == null ? null : { inr, percent: pct, basis: c.amount?.basis ?? null };
    }
    onSave(corrections, note);
  };

  const field = 'h-8 w-full rounded-md border border-input bg-background px-2 text-sm';
  return (
    <section aria-label="Correct the clause" className="space-y-2" data-testid="correct-form">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Correct the AI reading
      </span>
      <label className="block text-xs">
        Title
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-xs">
        Summary
        <textarea
          className={`${field} h-16 py-1`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          Clause number
          <input
            className={field}
            value={clauseRef}
            onChange={(e) => setClauseRef(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          Mandatory
          <select
            className={field}
            value={mandatory}
            onChange={(e) => setMandatory(e.target.value)}
          >
            <option value="">Not stated</option>
            <option value="MANDATORY">Mandatory</option>
            <option value="DESIRABLE">Desirable</option>
          </select>
        </label>
        <label className="block text-xs">
          Obligation
          <select
            className={field}
            value={obligation}
            onChange={(e) => setObligation(e.target.value)}
          >
            <option value="">Not stated</option>
            {OBLIGATIONS.map((o) => (
              <option key={o} value={o}>
                {OBLIGATION_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Stage
          <select className={field} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Not stated</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Amount (₹)
          <input
            className={field}
            inputMode="decimal"
            value={amountInr}
            onChange={(e) => setAmountInr(e.target.value)}
            data-testid="correct-amount"
          />
        </label>
        <label className="block text-xs">
          Percent
          <input
            className={field}
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-xs">
        Note (optional)
        <input className={field} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={save} data-testid="correct-save">
          Save correction
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
};
