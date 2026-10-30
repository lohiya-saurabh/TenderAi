import React, { useCallback } from 'react';
import { Page, PageHeader } from '@/components/ui/page.js';
import { useParams, Link } from 'react-router-dom';
import { listAuditEvents, type AuditEvent } from '@/api/audit.js';
import { useApi } from '@/hooks/useApi.js';
import { AuditTimeline } from '@/components/audit/AuditTimeline.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import { ArrowLeft } from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const fetchEvents = useCallback((signal: AbortSignal) => listAuditEvents(id, { signal }), [id]);
  const { data: events, isLoading, error, refetch } = useApi<AuditEvent[]>(fetchEvents, [id]);

  return (
    <Page width="narrow">
      <PageHeader
        back={
          <Link
            to={`/bids/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground no-underline hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Bid overview
          </Link>
        }
        title="Audit trail"
        description="Every upload, extraction, review and status change on this bid, newest first."
      />
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
    </Page>
  );
};
