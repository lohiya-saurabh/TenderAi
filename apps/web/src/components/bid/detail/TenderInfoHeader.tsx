import React from 'react';
import type { BidDetail } from '../../../api/bids.js';
import { formatDate } from '../../../utils/formatDate.js';
import { getDeadlineInfo } from '../../../utils/deadline.js';
import type { BidDecision } from './bidDetailData.js';

export interface TenderInfoHeaderProps {
  bid: BidDetail;
  decision?: BidDecision | null;
}

export const TenderInfoHeader: React.FC<TenderInfoHeaderProps> = ({ bid, decision }) => {
  const nowMs = Date.now();
  const deadline = bid.submissionDeadline ? getDeadlineInfo(bid.submissionDeadline, nowMs) : null;

  const deadlineLabel =
    deadline === null
      ? 'Deadline: Not specified'
      : deadline.urgency === 'passed'
        ? `Closed: ${formatDate(bid.submissionDeadline!)}`
        : `Due: ${formatDate(bid.submissionDeadline!)} (${deadline.daysLeft}d left)`;

  const verdict =
    decision?.verdict || (bid.status === 'REVIEW_READY' ? 'PURSUE' : 'REVIEW_REQUIRED');

  const verdictStyles =
    verdict === 'PURSUE'
      ? {
          bg: 'bg-primary/10',
          text: 'text-primary',
          border: 'border-primary/30',
          label: 'DETERMINISTIC VERDICT: PURSUE BID',
        }
      : verdict === 'DO_NOT_PURSUE'
        ? {
            bg: 'bg-destructive/10',
            text: 'text-destructive',
            border: 'border-destructive/30',
            label: 'DETERMINISTIC VERDICT: DO NOT PURSUE',
          }
        : {
            bg: 'bg-orange-500/10',
            text: 'text-orange-500',
            border: 'border-orange-500/30',
            label: 'DETERMINISTIC VERDICT: REVIEW REQUIRED',
          };

  return (
    <div className="space-y-3 pb-4 border-b border-border">
      {/* Top Memo & NIT Metadata Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`mono text-xs font-bold px-2.5 py-0.5 rounded border ${verdictStyles.bg} ${verdictStyles.text} ${verdictStyles.border}`}
          >
            {verdictStyles.label}
          </span>
          <span className="mono text-xs text-muted-foreground">
            CONFIDENTIAL MEMO #{bid.tenderNumber || bid.id.slice(0, 10).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {bid.tenderingAuthority && (
            <span className="text-xs mono font-bold px-2 py-0.5 rounded border border-border bg-card text-foreground">
              {bid.tenderingAuthority}
            </span>
          )}
          <span className="text-xs mono font-medium text-muted-foreground">
            NIT No. {bid.tenderNumber || '—'}
          </span>
          <span className="text-xs mono font-medium text-muted-foreground">· {deadlineLabel}</span>
        </div>
      </div>

      {/* Primary Authoritative Title */}
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-snug">
        {bid.title}
      </h1>

      {/* Subtitle & Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs mono text-muted-foreground">
          Prepared for Executive Board · Tender Evaluation Committee · Prepared on{' '}
          {formatDate(bid.createdAt)}
        </p>

        <span className="inline-flex items-center gap-1.5 text-xs mono font-bold px-2.5 py-0.5 rounded border border-border bg-card text-foreground">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              bid.status === 'REVIEW_READY'
                ? 'bg-primary'
                : bid.status === 'ANALYZING'
                  ? 'bg-orange-500 animate-pulse'
                  : 'bg-muted-foreground'
            }`}
          />
          {bid.status.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};
