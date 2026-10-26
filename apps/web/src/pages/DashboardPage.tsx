import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBids, type BidSummary } from '@/api/bids.js';
import { useApi } from '@/hooks/useApi.js';
import { useBidComplianceItems } from '@/hooks/useBidComplianceItems.js';
import { useAuth } from '@/auth/useAuth.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { Button } from '@/components/ui/button.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import { ErrorBanner, ErrorState } from '@/components/common/ErrorBanner.js';
import { Plus } from 'lucide-react';
import { DashboardKpiStrip } from '@/components/dashboard/DashboardKpiStrip.js';
import { ActionRequiredCard } from '@/components/dashboard/ActionRequiredCard.js';
import { CompanyReadinessCard } from '@/components/dashboard/CompanyReadinessCard.js';
import { UpcomingDeadlinesCard } from '@/components/dashboard/UpcomingDeadlinesCard.js';
import { BidPipelineCard } from '@/components/dashboard/BidPipelineCard.js';
import { TenderListSection } from '@/components/dashboard/TenderListSection.js';
import { MissingApiCallout } from '@/components/dashboard/MissingApiCallout.js';
import { computePipelineStages } from '@/components/dashboard/dashboardData.js';

// Module-level so the reference is stable, and so useApi's AbortSignal
// argument is never passed through as listBids' optional query.
const fetchBids = () => listBids();

export const DashboardPage: React.FC = () => {
  const { data: bids, isLoading, error, refetch } = useApi<BidSummary[]>(fetchBids);
  const { hasPermission } = useAuth();

  const { itemsByBid, isLoading: complianceLoading } = useBidComplianceItems(bids);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const canCreateBid = hasPermission(PERMISSIONS.BIDS_CREATE);
  const allBids = bids || [];

  const stages = useMemo(() => computePipelineStages(allBids), [allBids]);
  const archivedCount = useMemo(
    () => allBids.filter((b) => b.status === 'ARCHIVED').length,
    [allBids],
  );

  const handleSelectStage = (status: string) => {
    setSelectedStatus(status);
    document.getElementById('tender-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Bid Dashboard</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            What is happening with my bids — blockers, pipeline stage, deadlines, and tender
            readiness at a glance
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canCreateBid && (
            <Link to="/bids/new" className="no-underline shrink-0">
              <Button variant="default" size="sm" className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                New Bid Project
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={refetch} />}

      {error ? (
        <ErrorState
          title="Unable to load bid dashboard"
          message={error.message}
          onRetry={refetch}
        />
      ) : (
        <>
          {/* 2. Executive KPI Strip */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : (
            <DashboardKpiStrip bids={allBids} />
          )}

          {/* 3. Attention row: Action Required + Upcoming Deadlines */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-72 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
          ) : allBids.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActionRequiredCard
                bids={allBids}
                complianceByBid={itemsByBid}
                isLoadingCompliance={complianceLoading}
              />
              <UpcomingDeadlinesCard bids={allBids} />
            </div>
          ) : null}

          {/* 4. Bid Pipeline */}
          {isLoading ? (
            <Skeleton className="h-44 rounded-lg" />
          ) : allBids.length > 0 ? (
            <BidPipelineCard
              stages={stages}
              archivedCount={archivedCount}
              selectedStatus={selectedStatus}
              onSelectStage={handleSelectStage}
            />
          ) : null}

          {/* 5. Tender List */}
          <TenderListSection
            bids={allBids}
            isLoading={isLoading}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            onDeleted={refetch}
            canCreateBid={canCreateBid}
          />

          {/* 6. Company Readiness */}
          {!isLoading && <CompanyReadinessCard />}

          {/* 7. Documented Missing APIs Disclosure */}
          <MissingApiCallout />
        </>
      )}
    </div>
  );
};
