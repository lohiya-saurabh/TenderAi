import React, { useState, useMemo, useCallback } from 'react';
import type { ComplianceItem } from '@/api/compliance.js';
import { ComplianceRow } from '@/components/compliance/ComplianceRow.js';
import { StatusFilter, type ComplianceStatusFilterValue } from '@/components/compliance/StatusFilter.js';
import { EvidenceDrawer } from '@/components/compliance/EvidenceDrawer.js';
import { SourceCitationDrawer } from '@/components/compliance/SourceCitationDrawer.js';
import { AssessmentPanel } from '@/components/compliance/AssessmentPanel.js';
import { EmptyState } from '@/components/common/EmptyState.js';
import { ColumnSorter, type SortConfig } from '@/components/common/ColumnSorter.js';
import { Button } from '@/components/common/Button.js';
import { SearchIcon, CloseIcon, FilterIcon, ChevronRightIcon, ChevronDownIcon } from '@/components/common/Icons.js';

export type ComplianceGroupBy = 'NONE' | 'CATEGORY' | 'CLAUSE';

export function getClauseGroupKey(tenderClauseRef?: string): string {
  if (!tenderClauseRef) return 'General Tender Conditions';
  // Match named schedules/annexures/articles first (e.g. "Schedule G", "Article 7", "Annexure I")
  const namedMatch = tenderClauseRef.match(/^(Schedule|Annexure|Appendix|Article|Part)\s*[-–—]?\s*([A-Za-z0-9]+)/i);
  if (namedMatch && namedMatch[1] && namedMatch[2]) {
    const prefix = namedMatch[1];
    const ident = namedMatch[2];
    return `${prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()} ${ident.toUpperCase()}`;
  }
  // Group decimal/numbered clauses by their top-level major number (e.g. "4.1.3" -> "Section / Clause 4", "4 (i)" -> "Section / Clause 4")
  const numMatch = tenderClauseRef.match(/^(\d+)/);
  if (numMatch && numMatch[1]) {
    return `Section / Clause ${numMatch[1]}`;
  }
  return tenderClauseRef;
}

export interface ComplianceTableProps {
  items: ComplianceItem[];
  onReviewItem: (
    itemId: string,
    status: ComplianceItem['status'],
    notes?: string,
    expectedVersion?: number,
  ) => Promise<void>;
  onInspectEvidence?: (item: ComplianceItem) => void;
  onInspectCitation?: (item: ComplianceItem) => void;
  onInspectAssessment?: (item: ComplianceItem) => void;
}

const COLUMNS = [
  { key: 'requirement', label: 'Requirement', width: '30%' },
  { key: 'category', label: 'Category', width: '11%' },
  { key: 'mandatory', label: 'Mandatory', width: '8%' },
  { key: 'companyEvidence', label: 'Company Evidence', width: '18%' },
  { key: 'status', label: 'Status', width: '13%' },
  { key: 'risk', label: 'Risk', width: '10%' },
  { key: 'source', label: 'Source', width: '10%' },
] as const;

const CATEGORIES = [
  'ALL',
  'LEGAL',
  'TECHNICAL',
  'FINANCIAL',
  'STATUTORY',
  'EXECUTION',
  'COMMERCIAL',
  'OPERATIONAL',
] as const;
const RISKS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const MANDATORY_OPTIONS = [
  { value: 'ALL', label: 'All Requirements' },
  { value: 'MANDATORY', label: 'Mandatory Only' },
  { value: 'OPTIONAL', label: 'Optional Only' },
] as const;

export const ComplianceTable: React.FC<ComplianceTableProps> = ({
  items,
  onReviewItem,
  onInspectEvidence,
  onInspectCitation,
  onInspectAssessment,
}) => {
  // Filter states
  const [statusFilter, setStatusFilter] = useState<ComplianceStatusFilterValue>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [mandatoryFilter, setMandatoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sort & Expand states
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'requirement',
    direction: 'asc',
  });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Drawer states
  const [activeEvidenceItem, setActiveEvidenceItem] = useState<ComplianceItem | null>(null);
  const [activeCitationItem, setActiveCitationItem] = useState<ComplianceItem | null>(null);
  const [activeAssessmentItem, setActiveAssessmentItem] = useState<ComplianceItem | null>(null);

  // Defensive deduplication by id and by (category, title/requirement)
  const dedupedItems = useMemo(() => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const result: ComplianceItem[] = [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      const title = (item as { title?: string }).title || item.requirement || '';
      const key = `${(item.category || '').toLowerCase()}:${title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
      if (seenKeys.has(key)) continue;
      seenIds.add(item.id);
      seenKeys.add(key);
      result.push(item);
    }
    return result;
  }, [items]);

  // Helper to map DB/API statuses (APPROVED, FLAGGED, etc.) to UI filter values
  const mapToFilterStatus = (status: string): ComplianceStatusFilterValue => {
    const s = (status || '').toUpperCase();
    if (s === 'PASS' || s === 'APPROVED' || s === 'COMPLIANT') return 'PASS';
    if (s === 'FAIL' || s === 'FLAGGED' || s === 'REJECTED' || s === 'NON_COMPLIANT') return 'FAIL';
    if (s === 'MISSING') return 'MISSING';
    if (s === 'REVIEW_REQUIRED' || s === 'PENDING_REVIEW' || s === 'UNDER_REVIEW') return 'REVIEW_REQUIRED';
    if (s === 'NOT_APPLICABLE' || s === 'NA') return 'NOT_APPLICABLE';
    return 'ALL';
  };

  // Status counts for filter tabs
  const counts = useMemo(() => {
    const result: Record<ComplianceStatusFilterValue, number> = {
      ALL: dedupedItems.length,
      PASS: 0,
      FAIL: 0,
      MISSING: 0,
      REVIEW_REQUIRED: 0,
      NOT_APPLICABLE: 0,
    };
    dedupedItems.forEach((i) => {
      const fs = mapToFilterStatus(i.status);
      if (fs !== 'ALL') {
        result[fs] = (result[fs] || 0) + 1;
      }
    });
    return result;
  }, [dedupedItems]);

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    riskFilter !== 'ALL' ||
    mandatoryFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setRiskFilter('ALL');
    setMandatoryFilter('ALL');
    setSearchQuery('');
  };

  // Filter & Sort
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = dedupedItems.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && mapToFilterStatus(item.status) !== statusFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      // Risk filter
      if (riskFilter !== 'ALL' && (item.risk?.level || 'LOW') !== riskFilter) {
        return false;
      }

      // Mandatory filter
      if (mandatoryFilter === 'MANDATORY' && !item.isMandatory) {
        return false;
      }
      if (mandatoryFilter === 'OPTIONAL' && item.isMandatory) {
        return false;
      }

      // Search query across multiple fields
      if (query) {
        const matchReq = item.requirement.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        const matchSub = item.subCategory?.toLowerCase().includes(query);
        const matchClause = item.tenderClauseRef?.toLowerCase().includes(query);
        const matchEvidence = item.companyEvidence?.title.toLowerCase().includes(query);
        const matchDoc = item.provenance?.documentName?.toLowerCase().includes(query);
        const matchQuote = item.provenance?.verbatimQuote?.toLowerCase().includes(query);
        const matchRule = item.rationale?.ruleApplied?.toLowerCase().includes(query);

        if (
          !matchReq &&
          !matchCat &&
          !matchSub &&
          !matchClause &&
          !matchEvidence &&
          !matchDoc &&
          !matchQuote &&
          !matchRule
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort items
    result = [...result].sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [
    dedupedItems,
    statusFilter,
    categoryFilter,
    riskFilter,
    mandatoryFilter,
    searchQuery,
    sortConfig,
  ]);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  // Group By state
  const [groupBy, setGroupBy] = useState<ComplianceGroupBy>('NONE');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  }, []);

  const groupedItems = useMemo(() => {
    if (groupBy === 'NONE') return null;
    const groupMap = new Map<string, ComplianceItem[]>();
    for (const item of filteredItems) {
      const key =
        groupBy === 'CATEGORY'
          ? (item.category || 'OTHER')
          : getClauseGroupKey(item.tenderClauseRef);
      const list = groupMap.get(key) || [];
      list.push(item);
      groupMap.set(key, list);
    }
    return Array.from(groupMap.entries()).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [filteredItems, groupBy]);

  // Handlers for drawers
  const handleInspectEvidence = useCallback(
    (item: ComplianceItem) => {
      setActiveEvidenceItem(item);
      onInspectEvidence?.(item);
    },
    [onInspectEvidence],
  );

  const handleInspectCitation = useCallback(
    (item: ComplianceItem) => {
      setActiveCitationItem(item);
      onInspectCitation?.(item);
    },
    [onInspectCitation],
  );

  const handleInspectAssessment = useCallback(
    (item: ComplianceItem) => {
      setActiveAssessmentItem(item);
      onInspectAssessment?.(item);
    },
    [onInspectAssessment],
  );

  if (dedupedItems.length === 0) {
    return (
      <EmptyState
        title="No compliance items extracted yet"
        description="Upload a Notice Inviting Tender (NIT) document to extract requirements, evaluate company evidence, and ground source citations."
      />
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full">
      {/* 1 & 2. Unified Header Controls Toolbar */}
      <div className="p-4 sm:p-5 border-b border-border bg-card flex flex-col gap-3.5">
        {/* Primary Row: Status Filter Tabs & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />

          {/* Search Input */}
          <div className="relative w-full lg:w-72 xl:w-80 shrink-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center">
              <SearchIcon size={14} />
            </div>
            <input
              type="text"
              placeholder="Search clauses, evidence, rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-lg pl-8 pr-8 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <CloseIcon size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Row: Attribute Filters & Group By */}
        <div className="flex items-center gap-2.5 flex-wrap pt-1 text-xs text-muted-foreground justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <FilterIcon size={13} />
              <span className="text-[11px] uppercase tracking-wider font-semibold">Filter:</span>
            </div>

            {/* Category Select */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-background text-foreground border border-border rounded-md px-2.5 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
              aria-label="Filter by Category"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Risk Select */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-background text-foreground border border-border rounded-md px-2.5 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
              aria-label="Filter by Risk"
            >
              {RISKS.map((r) => (
                <option key={r} value={r}>
                  {r === 'ALL' ? 'All Risks' : `${r} Risk`}
                </option>
              ))}
            </select>

            {/* Mandatory Select */}
            <select
              value={mandatoryFilter}
              onChange={(e) => setMandatoryFilter(e.target.value)}
              className="bg-background text-foreground border border-border rounded-md px-2.5 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
              aria-label="Filter by Mandatory Status"
            >
              {MANDATORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2 ml-1"
              >
                Reset filters ({filteredItems.length} of {dedupedItems.length})
              </button>
            )}
          </div>

          {/* Group By Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ComplianceGroupBy)}
              className="bg-background text-foreground border border-border rounded-md px-2.5 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground font-medium"
              aria-label="Group by"
            >
              <option value="NONE">None</option>
              <option value="CATEGORY">Category</option>
              <option value="CLAUSE">Clause</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3 & 4. Table Header and Rows */}
      <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-thin">
        <div className="min-w-[1050px]">
          {/* Column Header Band */}
          <div className="grid grid-cols-[minmax(270px,3.2fr)_minmax(100px,1.1fr)_minmax(80px,0.9fr)_minmax(170px,1.8fr)_minmax(120px,1.2fr)_minmax(95px,1fr)_minmax(85px,0.9fr)] gap-3 px-5 py-3 bg-muted/40 border-b border-border text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
            {COLUMNS.map((col) => (
              <ColumnSorter
                key={col.key}
                columnKey={col.key}
                label={col.label}
                currentSort={sortConfig}
                onSort={handleSort}
              />
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <EmptyState
                title="No compliance items match your filters"
                description="Try broadening your search query or clearing the status/category filters."
                action={
                  <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                    Clear All Filters
                  </Button>
                }
              />
            </div>
          ) : groupedItems ? (
            <div className="divide-y divide-border/70">
              {groupedItems.map((group) => {
                const isCollapsed = Boolean(collapsedGroups[group.groupName]);
                return (
                  <div key={group.groupName} className="border-b border-border/80 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(group.groupName)}
                      className="w-full flex items-center justify-between px-5 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left select-none cursor-pointer border-l-2 border-l-orange-500"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRightIcon size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon size={14} color="#ea580c" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          {group.groupName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground">
                          {group.items.length}
                        </span>
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-border/70">
                        {group.items.map((item) => (
                          <ComplianceRow
                            key={item.id}
                            item={item}
                            isExpanded={expandedRowId === item.id}
                            onToggleExpand={toggleExpanded}
                            onReview={onReviewItem}
                            onInspectEvidence={handleInspectEvidence}
                            onInspectCitation={handleInspectCitation}
                            onInspectAssessment={handleInspectAssessment}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredItems.map((item) => (
                <ComplianceRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedRowId === item.id}
                  onToggleExpand={toggleExpanded}
                  onReview={onReviewItem}
                  onInspectEvidence={handleInspectEvidence}
                  onInspectCitation={handleInspectCitation}
                  onInspectAssessment={handleInspectAssessment}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Drawers / Detail Panels */}
      {/* Evidence Inspection Drawer */}
      <EvidenceDrawer
        isOpen={Boolean(activeEvidenceItem)}
        onClose={() => setActiveEvidenceItem(null)}
        evidence={activeEvidenceItem?.companyEvidence || null}
        requirementTitle={activeEvidenceItem?.requirement || ''}
      />

      {/* Source Citation & Grounding Drawer */}
      {activeCitationItem && (
        <SourceCitationDrawer
          isOpen={Boolean(activeCitationItem)}
          onClose={() => setActiveCitationItem(null)}
          citation={activeCitationItem.sourceCitation}
          provenance={activeCitationItem.provenance}
          requirementTitle={activeCitationItem.requirement}
          description={activeCitationItem.description}
        />
      )}

      {/* Assessment Rationale Drawer */}
      <AssessmentPanel
        isOpen={Boolean(activeAssessmentItem)}
        onClose={() => setActiveAssessmentItem(null)}
        rationale={activeAssessmentItem?.rationale || null}
        requirementTitle={activeAssessmentItem?.requirement || ''}
      />
    </div>
  );
};

function getSortValue(item: ComplianceItem, key: string): string | number | null {
  switch (key) {
    case 'requirement':
      return item.requirement.toLowerCase();
    case 'category':
      return item.category.toLowerCase();
    case 'mandatory':
      return item.isMandatory ? 1 : 0;
    case 'companyEvidence':
      return item.companyEvidence?.title?.toLowerCase() || '';
    case 'status':
      return item.status;
    case 'risk':
      return getRiskScore(item.risk?.level);
    case 'source':
      return item.provenance?.pageNumber || 0;
    default:
      return null;
  }
}

function getRiskScore(level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): number {
  switch (level) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
    default:
      return 1;
  }
}
