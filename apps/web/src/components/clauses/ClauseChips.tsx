import React from 'react';
import type { ClauseFlag, ClauseReview } from '@tenderpulse/shared-types';
import { cn } from '@/lib/utils.js';
import { REVIEW_LABEL } from './clauseFormat.js';

export type ChipTone = 'neutral' | 'outline' | 'strong' | 'bad' | 'warn' | 'ok' | 'review';

const TONE: Record<ChipTone, string> = {
  neutral: 'bg-muted text-foreground/80 border-transparent',
  outline: 'bg-transparent text-foreground border-border',
  strong: 'bg-foreground text-background border-transparent',
  bad: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40',
  warn: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40',
  ok: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  review:
    'bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/40',
};

/** Text chip; colour is never the only carrier of meaning. */
export const Chip: React.FC<{ tone?: ChipTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-5',
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
  return 'neutral';
}

export const ReviewBadge: React.FC<{ review: ClauseReview; withName?: boolean }> = ({
  review,
  withName = true,
}) => {
  const tone: ChipTone =
    review.status === 'NEEDS_REVIEW'
      ? 'review'
      : review.status === 'CONFIRMED' || review.status === 'CORRECTED'
        ? 'ok'
        : 'neutral';
  const who = withName && review.by && review.status !== 'UNREVIEWED' ? ` · ${review.by.name}` : '';
  return (
    <Chip tone={tone} className="max-w-full truncate">
      {REVIEW_LABEL[review.status]}
      {who}
    </Chip>
  );
};
