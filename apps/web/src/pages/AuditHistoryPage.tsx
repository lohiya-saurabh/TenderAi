import React, { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listAuditEvents, type AuditEvent } from '../api/audit.js';
import { useApi } from '../hooks/useApi.js';
import { AuditTimeline } from '../components/audit/AuditTimeline.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { ArrowLeft, ShieldCheck, History } from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const fetchEvents = useCallback(() => listAuditEvents(id), [id]);
  const { data: events, isLoading, error, refetch } = useApi<AuditEvent[]>(fetchEvents, [id]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center gap-2">
        <Link
          to={`/bids/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Bid Dossier
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          Immutable Provenance Log
        </span>
      </div>

      {/* 2. Header memo */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
            <History className="w-3 h-3" />
            Statutory Audit Trail
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <ShieldCheck className="w-3 h-3 text-foreground" />
            Append-Only Verification Log
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Tamper-Evident Audit Trail
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Cryptographically recorded timeline of all document extractions, human adjudications, risk waivers, and state transitions for this tender project.
        </p>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refetch} />}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <AuditTimeline events={events || []} />
      )}
    </div>
  );
};
