import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../utils/permissions.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { EmptyState } from '../common/EmptyState.js';
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
import { cn } from '../../lib/utils.js';

export interface TenderListSectionProps {
  bids: BidSummary[];
  isLoading: boolean;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
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
    <div id="tender-list" className="flex flex-col gap-3 scroll-mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Tender List</h2>
          <p className="text-xs text-muted-foreground">
            Search, filter, and sort every tender tracked within your organization tenant
          </p>
        </div>
      </div>

      {/* Status filter — toggle group */}
      <div
        role="group"
        aria-label="Filter tenders by workflow status"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
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
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border cursor-pointer whitespace-nowrap',
                isSelected
                  ? 'bg-accent text-accent-foreground border-border font-semibold shadow-xs'
                  : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  isSelected
                    ? 'bg-vermilion text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + risk filter + result count */}
      <div className="flex items-center gap-3 flex-wrap bg-card p-3 rounded-lg border border-border shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center">
            <SearchIcon size={14} />
          </span>
          <Input
            type="search"
            placeholder="Search by title, tender №, or authority..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search tenders"
            className="pl-9 pr-8 h-8 text-xs bg-background"
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {activeFilterDescriptions.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {activeFilterDescriptions.join(', ')}
          </span>
        )}

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Risk:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            aria-label="Filter by risk level"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            {RISK_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <span className="text-xs text-muted-foreground ml-auto">
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
              <Link to="/bids/new" className="no-underline">
                <Button variant="default" size="sm" className="gap-1.5">
                  <PlusCircleIcon size={15} />
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
