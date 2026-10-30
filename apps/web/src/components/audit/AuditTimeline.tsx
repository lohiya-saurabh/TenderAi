import React from 'react';
import type { AuditEvent } from '@/api/audit.js';
import { formatDateTime } from '@/utils/formatDate.js';
import { EmptyState } from '@/components/common/EmptyState.js';
import { History } from 'lucide-react';

export interface AuditTimelineProps {
  events: AuditEvent[];
}

/** "CLAUSE_REVIEWED" / "clauseReviewed" → "Clause reviewed". */
const words = (s: string) => {
  const w = s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim()
    .toLowerCase();
  return (w.charAt(0).toUpperCase() + w.slice(1)).replace(/\b(ai|id|pdf|url|emd|gst)\b/gi, (m) =>
    m.toUpperCase(),
  );
};

/** Flattens a payload into labelled fields (one level of nesting), never raw JSON. */
function payloadFields(payload: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  const add = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      const items = value.filter((v) => typeof v !== 'object');
      out.push([key, items.length === value.length ? items.join(', ') : `${value.length} items`]);
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v !== 'object' || v === null) add(`${key} ${words(k).toLowerCase()}`, v);
      }
    } else {
      out.push([key, String(value)]);
    }
  };
  for (const [k, v] of Object.entries(payload)) add(words(k), v);
  return out;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No activity yet"
        description="Uploads, extractions, reviews and status changes on this bid will appear here, newest first."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const fields = event.payload ? payloadFields(event.payload) : [];
        return (
          <li key={event.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-foreground">{words(event.eventType)}</h3>
              <time className="text-xs text-muted-foreground" dateTime={event.timestamp}>
                {formatDateTime(event.timestamp)}
              </time>
            </div>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {event.userName || event.userId} · {words(event.aggregateType).toLowerCase()}{' '}
              <span className="font-mono">{event.aggregateId}</span>
            </p>
            {fields.length > 0 && (
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                {fields.map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words text-foreground">{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
};
