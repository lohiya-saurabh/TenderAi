import React from 'react';
import type { AuditEvent } from '../../api/audit.js';
import { formatDateTime } from '../../utils/formatDate.js';
import { EmptyState } from '../common/EmptyState.js';
import { History, ShieldCheck, User, Database, Terminal } from 'lucide-react';

export interface AuditTimelineProps {
  events: AuditEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History size={36} className="text-muted-foreground" />}
        title="No audit events recorded"
        description="Every lifecycle transition and human review action on this bid will appear here in chronological order with tamper-evident cryptographic provenance."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 relative">
      {events.map((event, idx) => (
        <div key={event.id} className="relative flex gap-4 items-start group">
          {/* Timeline Column */}
          <div className="flex flex-col items-center self-stretch shrink-0 pt-4.5">
            {/* Precision Indicator Node */}
            <div className="w-3.5 h-3.5 rounded-full bg-background border-2 border-orange-600 flex items-center justify-center z-10 shrink-0 transition-transform group-hover:scale-125">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-600" />
            </div>
            {/* Connecting Vertical Track between consecutive events */}
            {idx < events.length - 1 && <div className="w-[2px] bg-border flex-1 mt-2 -mb-6" />}
          </div>

          {/* Event Card */}
          <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs transition-colors hover:border-foreground/20">
            {/* Header: Event Type + Timestamp */}
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="w-3 h-3" />
                  {event.eventType}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  <Database className="w-3 h-3" />
                  {event.aggregateType}{' '}
                  <span className="text-foreground/80">#{event.aggregateId}</span>
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDateTime(event.timestamp)}
              </span>
            </div>

            {/* Actor Information */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <User className="w-3.5 h-3.5 text-muted-foreground/80" />
              <span>
                Initiated by{' '}
                <strong className="text-foreground font-semibold">
                  {event.userName || event.userId}
                </strong>
              </span>
            </div>

            {/* Payload Metadata Inspector */}
            {event.payload && Object.keys(event.payload).length > 0 && (
              <div className="mt-2 bg-background/80 border border-border/80 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  <Terminal className="w-3 h-3" />
                  Audit Payload Signature
                </div>
                <pre className="font-mono text-xs text-foreground/90 overflow-x-auto p-1 leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
