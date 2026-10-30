import React from 'react';
import type { ClauseFlag, ClauseReview } from '@tenderpulse/shared-types';
import { cn } from '@/lib/utils.js';
import { REVIEW_LABEL } from './clauseFormat.js';

export type ChipTone =
  'neutral' | 'outline' | 'strong' | 'bad' | 'warn' | 'ok' | 'review' | 'amend' | 'fix';

// Design tones: confirmed is blue, needs-review orange, bad deep red; red/green never
// carry meaning on their own.
const TONE: Record<ChipTone, string> = {
  neutral: 'bg-muted text-foreground border-transparent dark:bg-white/10 dark:text-white/80',
  outline: 'bg-card text-foreground border-primary/40 dark:text-white/85 dark:border-white/25',
  strong: 'bg-foreground text-white border-transparent dark:bg-white dark:text-foreground',
  bad: 'bg-destructive/10 text-destructive border-destructive/40 dark:bg-destructive/10 dark:text-destructive dark:border-destructive/40',
  warn: 'bg-warning/10 text-warning border-warning/40 dark:bg-warning/10 dark:text-warning dark:border-warning/40',
  ok: 'bg-primary/10 text-primary border-transparent dark:bg-primary/15 dark:text-primary',
  review:
    'bg-warning/10 text-warning border-warning/40 dark:bg-warning/10 dark:text-warning dark:border-warning/40',
  amend: 'bg-success/10 text-success border-transparent dark:bg-success/15 dark:text-success',
  fix: 'bg-primary/10 text-primary border-transparent dark:bg-primary/15 dark:text-primary',
};

/** Text chip; colour is never the only carrier of meaning. */
export const Chip: React.FC<{ tone?: ChipTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium leading-[18px]',
      TONE[tone],
      className,
    )}
  >
    {children}
  </span>
);

export function flagTone(flag: ClauseFlag): ChipTone {
  if (flag === 'CONFLICT' || flag === 'QUOTE_NOT_FOUND') return 'bad';
  if (flag === 'NEAR_FAILED_PAGE') return 'warn';
  if (flag === 'AMENDED') return 'amend';
  return 'neutral';
}

export const ReviewBadge: React.FC<{ review: ClauseReview; withName?: boolean }> = ({
  review,
  withName = true,
}) => {
  const tone: ChipTone =
    review.status === 'NEEDS_REVIEW'
      ? 'review'
      : review.status === 'CONFIRMED'
        ? 'ok'
        : review.status === 'CORRECTED'
          ? 'fix'
          : 'neutral';
  const who = withName && review.by && review.status !== 'UNREVIEWED' ? ` · ${review.by.name}` : '';
  return (
    <Chip tone={tone} className="max-w-full truncate">
      {REVIEW_LABEL[review.status]}
      {who}
    </Chip>
  );
};
