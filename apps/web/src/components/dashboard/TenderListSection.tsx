import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import { Button } from '../common/Button.js';
import { EmptyState } from '../common/EmptyState.js';
import { SectionHeader } from '../common/PageLayout.js';
import { PlusCircleIcon, SearchIcon, TendersIcon, CloseIcon } from '../common/Icons.js';
import { TenderTableView, TenderTableSkeleton } from './TenderTableView.js';
import { useBreakpoint } from '../../hooks/useBreakpoint.js';
import {
  compareBids,
  filterBids,
  getVisibleColumns,
  describeActiveFilters,
  type RiskFilter,
  type SortDirection,
  type SortKey,
  DEFAULT_SORT_DIRECTION,
} from './tenderListData.js';

export interface TenderListSectionProps {
  /** All bids for the tenant (unfiltered) */
  bids: BidSummary[];
  isLoading: boolean;
  /** Workflow status filter shared with the Bid Pipeline card */
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  /** Refetch callback after a row deletion */
  onDeleted: () => void;
  canCreateBid: boolean;
}

const STATUS_TABS = [
  { key: 'ALL', label: 'All Tenders' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ANALYZING', label: 'Analyzing' },
  { key: 'REVIEW_READY', label: 'Review Ready' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'ARCHIVED', label: 'Archived' },
] as const;

const RISK_FILTER_OPTIONS: Array<{ value: RiskFilter; label: string }> = [
  { value: 'ALL', label: 'All Risk Levels' },
  { value: 'LOW', label: 'Low' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

/**
 * Tender List — the core list workflow.
 *
 * Owns search, status, risk, and sort state; renders the dense
 * TenderTableView with client-side pagination. Data sources:
 * - GET /api/v1/bids (list)
 * - GET /api/v1/bids/:id/bid-decision (per-row, N+1 — see MissingApiCallout)
 * Nothing is fabricated.
 */
export const TenderListSection: React.FC<TenderListSectionProps> = ({
  bids,
  isLoading,
  selectedStatus,
  onStatusChange,
  onDeleted,
  canCreateBid,
}) => {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission(PERMISSIONS.BIDS_DELETE);

  const breakpoint = useBreakpoint();
  const visibleColumns = getVisibleColumns(breakpoint);

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const statusCounts = useMemo(
    () => ({
      ALL: bids.length,
      DRAFT: bids.filter((b) => b.status === 'DRAFT').length,
      ANALYZING: bids.filter((b) => b.status === 'ANALYZING').length,
      REVIEW_READY: bids.filter((b) => b.status === 'REVIEW_READY').length,
      SUBMITTED: bids.filter((b) => b.status === 'SUBMITTED').length,
      ARCHIVED: bids.filter((b) => b.status === 'ARCHIVED').length,
    }),
    [bids],
  );

  const handleSortChange = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(DEFAULT_SORT_DIRECTION[key]);
    }
  };

  const clearSearch = () => setSearchTerm('');

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      clearSearch();
      (e.target as HTMLInputElement).blur();
    }
  };

  const filteredBids = useMemo(() => {
    const filtered = filterBids(bids, {
      search: searchTerm,
      status: selectedStatus,
      risk: riskFilter,
    });
    return filtered.sort((a, b) => compareBids(a, b, sortKey, sortDirection));
  }, [bids, searchTerm, selectedStatus, riskFilter, sortKey, sortDirection]);

  const activeFilterDescriptions = describeActiveFilters({
    search: searchTerm,
    status: selectedStatus,
    risk: riskFilter,
  });

  return (
    <div
      id="tender-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        scrollMarginTop: 'var(--space-6)',
      }}
    >
      <SectionHeader
        title="Tender List"
        description="Search, filter, and sort every tender tracked within your organization tenant"
        level="h2"
      />

      {/* Status filter — toggle group (aria-pressed) instead of fake tablist */}
      <div
        role="group"
        aria-label="Filter tenders by workflow status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
        }}
      >
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.key];
          const isSelected = selectedStatus === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onStatusChange(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                fontWeight: isSelected ? 600 : 500,
                backgroundColor: isSelected ? 'var(--color-primary-600)' : 'var(--color-surface-card)',
                color: isSelected ? '#ffffff' : 'var(--color-surface-muted)',
                border: isSelected ? '1px solid var(--color-primary-500)' : '1px solid var(--color-surface-border)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  padding: '0.05rem 0.35rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-surface-card-subtle)',
                  color: isSelected ? '#ffffff' : 'var(--color-surface-subtle)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + risk filter + result count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          backgroundColor: 'var(--color-surface-card)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-surface-border)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <span
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-surface-muted)',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <SearchIcon size={14} />
          </span>
          <input
            type="search"
            placeholder="Search by title, tender №, or authority..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search tenders"
            style={{
              width: '100%',
              backgroundColor: 'var(--color-surface-input)',
              color: 'var(--color-surface-text)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.45rem 2.2rem 0.45rem 2.2rem',
              fontSize: 'var(--text-xs)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-surface-muted)',
                cursor: 'pointer',
                padding: '0.15rem',
                display: 'flex',
              }}
            >
              <CloseIcon size={14} color="var(--color-surface-muted)" />
            </button>
          )}
        </div>

        {activeFilterDescriptions.length > 0 && (
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
            {activeFilterDescriptions.join(', ')}
          </span>
        )}

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-muted)',
          }}
        >
          <span>Risk:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            aria-label="Filter by risk level"
            style={{
              backgroundColor: 'var(--color-surface-input)',
              color: 'var(--color-surface-text)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.35rem 0.6rem',
              fontSize: 'var(--text-xs)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {RISK_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', marginLeft: 'auto' }}>
          {filteredBids.length} of {bids.length} tenders
        </span>
      </div>

      {/* Table / states */}
      {isLoading ? (
        <TenderTableSkeleton visibleColumns={visibleColumns} rows={8} />
      ) : bids.length === 0 ? (
        <EmptyState
          icon={<TendersIcon size={36} color="var(--color-primary-400)" />}
          title="No Tender Projects in Pipeline"
          description="Upload your first public tender specifications (NIT / BOQ) to initiate automatic clause extraction, qualification analysis, and bid/no-bid evaluation."
          action={
            canCreateBid ? (
              <Link to="/bids/new" style={{ textDecoration: 'none' }}>
                <Button variant="primary" startIcon={<PlusCircleIcon size={16} />}>
                  Create First Bid Project
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : filteredBids.length === 0 ? (
        <EmptyState
          title="No Tenders Match Criteria"
          description={
            activeFilterDescriptions.length > 0
              ? `Zero tenders matched the current filters (${activeFilterDescriptions.join(', ')}).`
              : 'Zero tenders matched the current filters.'
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setRiskFilter('ALL');
                onStatusChange('ALL');
              }}
            >
              Clear All Filters
            </Button>
          }
        />
      ) : (
        <TenderTableView
          bids={filteredBids}
          totalCount={bids.length}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onDeleted={onDeleted}
          canDelete={canDelete}
        />
      )}
    </div>
  );
};
