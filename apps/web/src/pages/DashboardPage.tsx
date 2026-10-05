import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBids, type BidSummary } from '../api/bids.js';
import { useApi } from '../hooks/useApi.js';
import { useBidComplianceItems } from '../hooks/useBidComplianceItems.js';
import { useAuth } from '../auth/useAuth.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { Button } from '../components/common/Button.js';
import { ErrorBanner, ErrorState } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import { PageHeader } from '../components/common/PageLayout.js';
import { PlusCircleIcon } from '../components/common/Icons.js';
import { DashboardKpiStrip } from '../components/dashboard/DashboardKpiStrip.js';
import { ActionRequiredCard } from '../components/dashboard/ActionRequiredCard.js';
import { CompanyReadinessCard } from '../components/dashboard/CompanyReadinessCard.js';
import { UpcomingDeadlinesCard } from '../components/dashboard/UpcomingDeadlinesCard.js';
import { BidPipelineCard } from '../components/dashboard/BidPipelineCard.js';
import { TenderListSection } from '../components/dashboard/TenderListSection.js';
import { MissingApiCallout } from '../components/dashboard/MissingApiCallout.js';
import { computePipelineStages } from '../components/dashboard/dashboardData.js';

export const DashboardPage: React.FC = () => {
  const { data: bids, isLoading, error, refetch } = useApi<BidSummary[]>(listBids);
  const { hasPermission } = useAuth();

  // Clause-level compliance items for every active bid (parallel, existing API)
  const { itemsByBid, isLoading: complianceLoading } = useBidComplianceItems(bids);

  // Workflow status filter shared between the Bid Pipeline card and the Tender List
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const canCreateBid = hasPermission(PERMISSIONS.BIDS_CREATE);

  const allBids = bids || [];

  const stages = useMemo(() => computePipelineStages(allBids), [allBids]);
  const archivedCount = useMemo(
    () => allBids.filter((b) => b.status === 'ARCHIVED').length,
    [allBids],
  );

  // Selecting a pipeline stage filters the Tender List and scrolls to it
  const handleSelectStage = (status: string) => {
    setSelectedStatus(status);
    document
      .getElementById('tender-list')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Page Header */}
      <PageHeader
        title="Bid Dashboard"
        subtitle="What is happening with my bids — blockers, pipeline stage, deadlines, and tender readiness at a glance"
        actions={
          canCreateBid ? (
            <Link to="/bids/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary" startIcon={<PlusCircleIcon size={16} />}>
                New Bid Project
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Error state: surface the failure honestly — never render the
          "no tenders" empty state when the API actually failed */}
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <LoadingSkeleton height="95px" borderRadius="var(--radius-lg)" />
              <LoadingSkeleton height="95px" borderRadius="var(--radius-lg)" />
              <LoadingSkeleton height="95px" borderRadius="var(--radius-lg)" />
              <LoadingSkeleton height="95px" borderRadius="var(--radius-lg)" />
            </div>
          ) : (
            <DashboardKpiStrip bids={allBids} />
          )}

          {/* 3. Attention row: Action Required + Upcoming Deadlines */}
          {isLoading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <LoadingSkeleton height="300px" borderRadius="var(--radius-lg)" />
              <LoadingSkeleton height="300px" borderRadius="var(--radius-lg)" />
            </div>
          ) : allBids.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
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
            <LoadingSkeleton height="180px" borderRadius="var(--radius-lg)" />
          ) : allBids.length > 0 ? (
            <BidPipelineCard
              stages={stages}
              archivedCount={archivedCount}
              selectedStatus={selectedStatus}
              onSelectStage={handleSelectStage}
            />
          ) : null}

          {/* 5. Tender List — the core list workflow */}
          <TenderListSection
            bids={allBids}
            isLoading={isLoading}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            onDeleted={refetch}
            canCreateBid={canCreateBid}
          />

          {/* 6. Company Readiness (honest missing-API state) */}
          {!isLoading && <CompanyReadinessCard />}

          {/* 7. Documented Missing APIs Disclosure */}
          <MissingApiCallout />
        </>
      )}
    </div>
  );
};
