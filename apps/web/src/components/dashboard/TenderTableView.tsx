import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '../../api/bids.js';
import { deleteBid } from '../../api/bids.js';
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../common/Table.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { RiskBadge } from '../common/RiskBadge.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';
import { Tooltip } from '../common/Tooltip.js';
import { LoadingSkeleton } from '../common/LoadingSkeleton.js';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MissingIcon,
  TrashIcon,
} from '../common/Icons.js';
import { ErrorBanner } from '../common/ErrorBanner.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/formatDate.js';
import { useBreakpoint } from '../../hooks/useBreakpoint.js';
import { computeReadiness, computeRiskLevel } from '../../utils/readiness.js';
import {
  getPageNumbers,
  getPaginationRange,
  getPageSlice,
  getTotalPages,
  getRowActionLabel,
  getVisibleColumns,
  getDeadlineInfo,
  isValidDeadline,
  type ColumnKey,
  type SortDirection,
  type SortKey,
  SORTABLE_COLUMNS,
} from './tenderListData.js';

export interface TenderTableViewProps {
  /** Filtered + sorted full list (the table slices pages internally) */
  bids: BidSummary[];
  /** Total bid count before filtering, for the pagination summary */
  totalCount: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  /** Invoked after a successful delete so the parent refetches the list */
  onDeleted?: () => void;
  canDelete: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/** Column widths that sum to 100% for consistent layout. */
const COLUMN_WIDTHS: Record<ColumnKey, string> = {
  tender: '20%',
  organization: '13%',
  value: '8%',
  deadline: '11%',
  status: '9%',
  fit: '7%',
  recommendation: '9%',
  risk: '7%',
  readiness: '10%',
  actions: '6%',
};

const NOT_EVALUATED_TOOLTIP =
  'No bid decision evaluated yet — run Bid/No-Bid from the tender detail page';

/** "Not evaluated" placeholder for signals the backend does not expose. */
function NotEvaluatedCell(): React.ReactElement {
  return (
    <Tooltip content={NOT_EVALUATED_TOOLTIP} position="top">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: 'var(--color-surface-subtle)',
          fontSize: 'var(--text-2xs)',
          whiteSpace: 'nowrap',
          cursor: 'help',
        }}
      >
        <MissingIcon size={12} />
        Not evaluated
      </span>
    </Tooltip>
  );
}

/**
 * Table-shaped skeleton that mirrors the column layout. Keeps the
 * visual structure during initial load and prevents layout shift.
 */
export const TenderTableSkeleton: React.FC<{
  visibleColumns: ColumnKey[];
  rows?: number;
}> = ({ visibleColumns, rows = 8 }) => (
  <TableContainer bordered aria-busy="true" aria-label="Loading tenders">
    <Table compact>
      <TableHead>
        <TableRow>
          {visibleColumns.map((column) => (
            <TableHeader key={column} width={COLUMN_WIDTHS[column]}>
              <LoadingSkeleton height="12px" width="70%" borderRadius="var(--radius-sm)" />
            </TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {visibleColumns.map((column) => (
              <TableCell key={column} align={column === 'value' || column === 'actions' ? 'right' : 'left'}>
                <LoadingSkeleton height="12px" width={column === 'actions' ? '40%' : '60%'} borderRadius="var(--radius-sm)" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

interface SortableHeaderProps {
  label: string;
  columnKey: ColumnKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  align?: 'left' | 'center' | 'right';
}

function SortableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSortChange,
  align,
}: SortableHeaderProps) {
  const columnSortKey = SORTABLE_COLUMNS[columnKey];

  if (!columnSortKey) {
    return (
      <TableHeader align={align} width={COLUMN_WIDTHS[columnKey]}>
        {label}
      </TableHeader>
    );
  }

  const isActive = sortKey === columnSortKey;

  return (
    <TableHeader
      align={align}
      width={COLUMN_WIDTHS[columnKey]}
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSortChange(columnSortKey)}
        title={`Sort by ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          color: isActive ? 'var(--color-primary-400)' : 'inherit',
          textTransform: 'inherit',
          letterSpacing: 'inherit',
        }}
      >
        {label}
        {isActive &&
          (sortDirection === 'asc' ? (
            <ChevronUpIcon size={12} color="var(--color-primary-400)" />
          ) : (
            <ChevronDownIcon size={12} color="var(--color-primary-400)" />
          ))}
      </button>
    </TableHeader>
  );
}

/** Deadline cell with days-left urgency coloring. Invalid dates render "—". */
function DeadlineCell({ bid, nowMs }: { bid: BidSummary; nowMs: number }) {
  if (!isValidDeadline(bid.submissionDeadline)) {
    return <span style={{ color: 'var(--color-surface-subtle)' }}>—</span>;
  }

  const { daysLeft, urgency } = getDeadlineInfo(bid.submissionDeadline!, nowMs);

  const label =
    urgency === 'passed'
      ? 'Window closed'
      : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  const color =
    urgency === 'urgent'
      ? 'var(--color-danger)'
      : urgency === 'soon'
        ? 'var(--color-warning)'
        : urgency === 'passed'
          ? 'var(--color-surface-subtle)'
          : 'var(--color-surface-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {formatDate(bid.submissionDeadline!)}
      </span>
      <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

/** Readiness cell: approved/total progress bar (null = pending intake). */
function ReadinessCell({ bid }: { bid: BidSummary }) {
  const { total, approved, pct } = computeReadiness(bid);

  if (total === 0) {
    return (
      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)' }}>
        Pending intake
      </span>
    );
  }

  const barColor =
    pct !== null && pct >= 80
      ? 'var(--color-success)'
      : pct !== null && pct >= 50
        ? 'var(--color-warning)'
        : 'var(--color-primary-500)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '96px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--text-2xs)',
          fontWeight: 600,
        }}
      >
        <span style={{ color: pct !== null && pct >= 80 ? 'var(--color-success)' : 'var(--color-surface-text)' }}>
          {pct}%
        </span>
        <span style={{ color: 'var(--color-surface-muted)' }}>
          {approved}/{total}
        </span>
      </div>
      <div
        style={{
          height: '4px',
          backgroundColor: 'var(--color-surface-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct ?? 0}%`,
            backgroundColor: barColor,
            borderRadius: 'var(--radius-full)',
          }}
        />
      </div>
    </div>
  );
}

export const TenderTableView: React.FC<TenderTableViewProps> = ({
  bids,
  totalCount,
  sortKey,
  sortDirection,
  onSortChange,
  onDeleted,
  canDelete,
}) => {
  const breakpoint = useBreakpoint();
  const visibleColumns = getVisibleColumns(breakpoint);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  // Delete flow state
  const [deleteTarget, setDeleteTarget] = useState<BidSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset to the first page whenever the filtered/sorted list changes
  useEffect(() => {
    setPage(1);
  }, [bids]);

  const totalPages = getTotalPages(bids.length, pageSize);
  const safePage = Math.min(page, totalPages);
  const pageBids = getPageSlice(bids, safePage, pageSize);
  const range = getPaginationRange(safePage, pageSize, bids.length);
  const nowMs = Date.now();

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteBid(deleteTarget.id);
    setIsDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      onDeleted?.();
    } else {
      setDeleteError(result.error.message);
    }
  };

  const renderCell = (bid: BidSummary, column: ColumnKey): React.ReactNode => {
    switch (column) {
      case 'tender':
        return (
          <Link
            to={`/bids/${bid.id}`}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textDecoration: 'none' }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                lineHeight: 1.3,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary-400)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-surface-text)')}
            >
              {bid.title}
            </span>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-surface-muted)',
              }}
            >
              № {bid.tenderNumber}
            </span>
          </Link>
        );
      case 'organization':
        return (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', fontWeight: 500 }}>
            {bid.tenderingAuthority}
          </span>
        );
      case 'value':
        return (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', whiteSpace: 'nowrap' }}>
            {bid.estimatedValueRupees ? formatCurrency(bid.estimatedValueRupees) : '—'}
          </span>
        );
      case 'deadline':
        return <DeadlineCell bid={bid} nowMs={nowMs} />;
      case 'status':
        return <StatusBadge status={bid.status} size="sm" />;
      case 'fit':
        return <NotEvaluatedCell />;
      case 'recommendation':
        return <NotEvaluatedCell />;
      case 'risk': {
        const level = computeRiskLevel(bid);
        const flagged = bid.flaggedRequirements || 0;
        return flagged > 0 ? (
          <RiskBadge level={level} label={`${flagged} flagged`} size="sm" />
        ) : (
          <RiskBadge level="LOW" label="Clean" size="sm" />
        );
      }
      case 'readiness':
        return <ReadinessCell bid={bid} />;
      case 'actions':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
            <Link to={`/bids/${bid.id}`}>
              <Button variant="ghost" size="sm">
                {getRowActionLabel(bid.status)}
              </Button>
            </Link>
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(bid);
                }}
                disabled={isDeleting}
                aria-label={`Delete ${bid.title}`}
                title="Delete tender project"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-surface-subtle)',
                  cursor: isDeleting ? 'wait' : 'pointer',
                  padding: '0.3rem 0.5rem',
                  fontSize: 'var(--text-xs)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-danger)';
                  e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-surface-subtle)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <TrashIcon size={12} />
                Delete
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TableContainer bordered>
        <Table compact>
          <TableHead>
            <TableRow>
              <SortableHeader
                label="Tender"
                columnKey="tender"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
              {visibleColumns.includes('organization') && (
                <SortableHeader
                  label="Organization"
                  columnKey="organization"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={onSortChange}
                />
              )}
              {visibleColumns.includes('value') && (
                <SortableHeader
                  label="Est. Value"
                  columnKey="value"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={onSortChange}
                  align="right"
                />
              )}
              <SortableHeader
                label="Deadline"
                columnKey="deadline"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
              <SortableHeader
                label="Status"
                columnKey="status"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
              {visibleColumns.includes('fit') && (
                <TableHeader width={COLUMN_WIDTHS.fit}>Fit</TableHeader>
              )}
              {visibleColumns.includes('recommendation') && (
                <TableHeader width={COLUMN_WIDTHS.recommendation}>
                  Recommendation
                </TableHeader>
              )}
              {visibleColumns.includes('risk') && (
                <SortableHeader
                  label="Risk"
                  columnKey="risk"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={onSortChange}
                />
              )}
              <SortableHeader
                label="Readiness"
                columnKey="readiness"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
              />
              <TableHeader width={COLUMN_WIDTHS.actions} align="right">
                Actions
              </TableHeader>
            </TableRow>
          </TableHead>

          <TableBody>
            {pageBids.map((bid) => (
              <TableRow key={bid.id}>
                {visibleColumns.map((column) => (
                  <TableCell key={column} align={column === 'value' || column === 'actions' ? 'right' : 'left'}>
                    {renderCell(bid, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          padding: '0.7rem 1rem',
          backgroundColor: 'var(--color-surface-card)',
          border: '1px solid var(--color-surface-border)',
          borderTop: 'none',
          borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Showing {range.start}–{range.end} of {bids.length}
          {bids.length !== totalCount ? ` (filtered from ${totalCount})` : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* Page size */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
            }}
          >
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                backgroundColor: 'var(--color-surface-input)',
                color: 'var(--color-surface-text)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.5rem',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {/* Page numbers */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-sm)',
                color: safePage <= 1 ? 'var(--color-surface-subtle)' : 'var(--color-surface-text)',
                cursor: safePage <= 1 ? 'default' : 'pointer',
                padding: '0.25rem 0.4rem',
                display: 'inline-flex',
              }}
            >
              <ChevronLeftIcon size={14} />
            </button>

            {getPageNumbers(safePage, totalPages).map((pageItem, index) =>
              pageItem === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  style={{ color: 'var(--color-surface-subtle)', padding: '0 0.15rem', fontSize: 'var(--text-xs)' }}
                >
                  …
                </span>
              ) : (
                <button
                  key={pageItem}
                  type="button"
                  onClick={() => setPage(pageItem)}
                  aria-current={pageItem === safePage ? 'page' : undefined}
                  style={{
                    minWidth: '28px',
                    background: pageItem === safePage ? 'var(--color-primary-600)' : 'transparent',
                    border: '1px solid var(--color-surface-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: pageItem === safePage ? '#ffffff' : 'var(--color-surface-text)',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    fontSize: 'var(--text-xs)',
                    fontWeight: pageItem === safePage ? 600 : 400,
                  }}
                >
                  {pageItem}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-sm)',
                color: safePage >= totalPages ? 'var(--color-surface-subtle)' : 'var(--color-surface-text)',
                cursor: safePage >= totalPages ? 'default' : 'pointer',
                padding: '0.25rem 0.4rem',
                display: 'inline-flex',
              }}
            >
              <ChevronRightIcon size={14} />
            </button>
          </nav>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete Tender Project"
        description="This action is permanent and cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={isDeleting}>
              Yes, Delete Permanently
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, lineHeight: 'var(--leading-normal)' }}>
            Are you sure you want to delete{' '}
            <strong>{deleteTarget?.title}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', lineHeight: 'var(--leading-normal)' }}>
            This permanently removes the tender project, all uploaded documents,
            and the derived compliance matrix. Cloud storage objects are pruned.
          </p>
          {deleteError && <ErrorBanner message={deleteError} />}
        </div>
      </Modal>
    </div>
  );
};