import React, { useCallback } from 'react';
import { Page, PageHeader } from '@/components/ui/page.js';
import { useParams } from 'react-router-dom';
import { getBid } from '@/api/bids.js';
import { useSetBidBreadcrumbTitle } from '@/components/layout/BreadcrumbTitle.js';
import { listAuditEvents, type AuditEvent } from '@/api/audit.js';
import { useApi } from '@/hooks/useApi.js';
import { AuditTimeline } from '@/components/audit/AuditTimeline.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Skeleton } from '@/components/ui/skeleton.js';

export const AuditHistoryPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const fetchEvents = useCallback((signal: AbortSignal) => listAuditEvents(id, { signal }), [id]);
  const { data: events, isLoading, error, refetch } = useApi<AuditEvent[]>(fetchEvents, [id]);
  const fetchBid = useCallback((signal: AbortSignal) => getBid(id, { signal }), [id]);
  const { data: bid } = useApi(fetchBid, [id]);
  useSetBidBreadcrumbTitle(id, bid?.title ?? null);

  return (
    <Page width="narrow">
      <PageHeader
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
