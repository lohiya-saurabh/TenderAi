import React, { useState, useMemo, useCallback } from 'react';
import type { ComplianceItem } from '../../api/compliance.js';
import { ComplianceRow } from './ComplianceRow.js';
import { StatusFilter, type ComplianceStatusFilterValue } from './StatusFilter.js';
import { EvidenceDrawer } from './EvidenceDrawer.js';
import { SourceCitationDrawer } from './SourceCitationDrawer.js';
import { AssessmentPanel } from './AssessmentPanel.js';
import { EmptyState } from '../common/EmptyState.js';
import { ColumnSorter, type SortConfig } from '../common/ColumnSorter.js';
import { Button } from '../common/Button.js';
import { SearchIcon, CloseIcon, FilterIcon } from '../common/Icons.js';

export interface ComplianceTableProps {
  items: ComplianceItem[];
  onReviewItem: (itemId: string, status: ComplianceItem['status'], notes?: string, expectedVersion?: number) => Promise<void>;
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

const CATEGORIES = ['ALL', 'LEGAL', 'TECHNICAL', 'FINANCIAL', 'STATUTORY', 'EXECUTION', 'COMMERCIAL'] as const;
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'requirement', direction: 'asc' });
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Drawer states
  const [activeEvidenceItem, setActiveEvidenceItem] = useState<ComplianceItem | null>(null);
  const [activeCitationItem, setActiveCitationItem] = useState<ComplianceItem | null>(null);
  const [activeAssessmentItem, setActiveAssessmentItem] = useState<ComplianceItem | null>(null);

  // Status counts for filter tabs
  const counts = useMemo(() => {
    const allStatuses: ComplianceStatusFilterValue[] = ['ALL', 'PASS', 'FAIL', 'MISSING', 'REVIEW_REQUIRED', 'NOT_APPLICABLE'];
    const result: Record<ComplianceStatusFilterValue, number> = {} as Record<ComplianceStatusFilterValue, number>;
    result.ALL = items.length;
    allStatuses.slice(1).forEach((status) => {
      result[status] = items.filter((i) => i.status === status).length;
    });
    return result;
  }, [items]);

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

    let result = items.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
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

        if (!matchReq && !matchCat && !matchSub && !matchClause && !matchEvidence && !matchDoc && !matchQuote && !matchRule) {
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
  }, [items, statusFilter, categoryFilter, riskFilter, mandatoryFilter, searchQuery, sortConfig]);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  // Handlers for drawers
  const handleInspectEvidence = useCallback((item: ComplianceItem) => {
    setActiveEvidenceItem(item);
    onInspectEvidence?.(item);
  }, [onInspectEvidence]);

  const handleInspectCitation = useCallback((item: ComplianceItem) => {
    setActiveCitationItem(item);
    onInspectCitation?.(item);
  }, [onInspectCitation]);

  const handleInspectAssessment = useCallback((item: ComplianceItem) => {
    setActiveAssessmentItem(item);
    onInspectAssessment?.(item);
  }, [onInspectAssessment]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No compliance items extracted yet"
        description="Upload a Notice Inviting Tender (NIT) document to extract requirements, evaluate company evidence, and ground source citations."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. Status Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />

        {/* Search input with icons */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 auto', maxWidth: '400px' }}>
          <div
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-surface-muted)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <SearchIcon size={14} />
          </div>
          <input
            type="text"
            placeholder="Search requirements, clauses, evidence, rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--color-surface-card)',
              color: 'var(--color-surface-text)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.45rem 2rem 0.45rem 2.2rem',
              fontSize: 'var(--text-xs)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-surface-muted)',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Secondary Filter Toolbar (Category, Risk, Mandatory, Reset) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '0.6rem 0.85rem',
          backgroundColor: 'var(--color-surface-card-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-surface-border)',
          fontSize: 'var(--text-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-surface-muted)', fontWeight: 600 }}>
          <FilterIcon size={14} />
          <span>Filters:</span>
        </div>

        {/* Category Select */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-surface-text)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.25rem 0.5rem',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
          }}
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
          style={{
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-surface-text)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.25rem 0.5rem',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
          }}
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
          style={{
            backgroundColor: 'var(--color-surface-card)',
            color: 'var(--color-surface-text)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.25rem 0.5rem',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
          }}
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
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Reset Filters ({filteredItems.length} of {items.length} items)
          </Button>
        )}
      </div>

      {/* 3. Table Column Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS.map((c) => c.width).join(' '),
          gap: '0.75rem',
          padding: '0.6rem 1rem',
          backgroundColor: 'var(--color-surface-bg)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-surface-muted)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
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

      {/* 4. Table Row List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          title="No compliance items match your filters"
          description="Try broadening your search query or clearing the status/category filters."
          action={
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear All Filters
            </Button>
          }
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
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