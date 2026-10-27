import React from 'react';
import type { ClauseFlag, ClauseReview } from '@tenderpulse/shared-types';
import { cn } from '@/lib/utils.js';
import { REVIEW_LABEL } from './clauseFormat.js';

export type ChipTone =
  'neutral' | 'outline' | 'strong' | 'bad' | 'warn' | 'ok' | 'review' | 'amend' | 'fix';

// Design tones: confirmed is blue, needs-review orange, bad deep red; red/green never
// carry meaning on their own.
const TONE: Record<ChipTone, string> = {
  neutral: 'bg-[#EEF0F3] text-[#3D4452] border-transparent dark:bg-white/10 dark:text-white/80',
  outline: 'bg-card text-[#2B313C] border-[#C9D0DA] dark:text-white/85 dark:border-white/25',
  strong: 'bg-[#16191F] text-white border-transparent dark:bg-white dark:text-[#16191F]',
  bad: 'bg-[#FDECEC] text-[#9F1C1C] border-[#F4BABA] dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40',
  warn: 'bg-[#FFF7D6] text-[#6E4B00] border-[#EBD27A] dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40',
  ok: 'bg-[#E6EEFF] text-[#1C3DA8] border-transparent dark:bg-blue-500/15 dark:text-blue-300',
  review:
    'bg-[#FFF1E0] text-[#8A4200] border-[#F3C48B] dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/40',
  amend: 'bg-[#E2F4F1] text-[#0B5F58] border-transparent dark:bg-teal-500/15 dark:text-teal-300',
  fix: 'bg-[#F1E9FF] text-[#5A2CB0] border-transparent dark:bg-violet-500/15 dark:text-violet-300',
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
