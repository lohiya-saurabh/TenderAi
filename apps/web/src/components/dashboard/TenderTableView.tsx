import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BidSummary } from '@/api/bids.js';
import { deleteBid } from '@/api/bids.js';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table.js';
import { Button } from '@/components/ui/button.js';
import { Progress } from '@/components/ui/progress.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { StatusBadge } from '@/components/common/StatusBadge.js';
import { RiskBadge } from '@/components/common/RiskBadge.js';
import { Tooltip } from '@/components/common/Tooltip.js';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MissingIcon,
  TrashIcon,
} from '@/components/common/Icons.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { formatDate } from '@/utils/formatDate.js';
import { useBreakpoint } from '@/hooks/useBreakpoint.js';
import { computeReadiness, computeRiskLevel } from '@/utils/readiness.js';
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
} from '@/components/dashboard/tenderListData.js';
import { cn } from '@/lib/utils.js';

export interface TenderTableViewProps {
  bids: BidSummary[];
  totalCount: number;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  onDeleted?: () => void;
  canDelete: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const COLUMN_WIDTHS: Record<ColumnKey, string> = {
  tender: '22%',
  organization: '14%',
  value: '8%',
  deadline: '11%',
  status: '9%',
  fit: '7%',
  recommendation: '9%',
  risk: '7%',
  readiness: '10%',
  actions: '6%',
};

const COLUMN_MIN_WIDTHS: Record<ColumnKey, string> = {
  tender: 'min-w-[260px] max-w-[380px]',
  organization: 'min-w-[150px] max-w-[220px]',
  value: 'min-w-[110px]',
  deadline: 'min-w-[125px]',
  status: 'min-w-[120px]',
  fit: 'min-w-[90px]',
  recommendation: 'min-w-[120px]',
  risk: 'min-w-[100px]',
  readiness: 'min-w-[130px]',
  actions: 'min-w-[90px]',
};

const NOT_EVALUATED_TOOLTIP =
  'No bid decision evaluated yet — run Bid/No-Bid from the tender detail page';

function NotEvaluatedCell(): React.ReactElement {
  return (
    <Tooltip content={NOT_EVALUATED_TOOLTIP} position="top">
      <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px] whitespace-nowrap cursor-help">
        <MissingIcon size={12} />
        Not evaluated
      </span>
    </Tooltip>
  );
}

export const TenderTableSkeleton: React.FC<{
  visibleColumns: ColumnKey[];
  rows?: number;
}> = ({ visibleColumns, rows = 8 }) => (
  <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
    <Table className="w-full min-w-[1100px] table-auto">
      <TableHeader>
        <TableRow>
          {visibleColumns.map((column) => (
            <TableHead
              key={column}
              style={{ width: COLUMN_WIDTHS[column] }}
              className={COLUMN_MIN_WIDTHS[column]}
            >
              <Skeleton className="h-3 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {visibleColumns.map((column) => (
              <TableCell
                key={column}
                className={cn(
                  column === 'value' || column === 'actions' ? 'text-right' : 'text-left',
                  COLUMN_MIN_WIDTHS[column],
                )}
              >
                <Skeleton className={cn('h-3.5', column === 'actions' ? 'w-12 ml-auto' : 'w-24')} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
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
      <TableHead
        className={cn(
          align === 'right' && 'text-right',
          'text-xs font-semibold uppercase tracking-wider',
          COLUMN_MIN_WIDTHS[columnKey],
        )}
        style={{ width: COLUMN_WIDTHS[columnKey] }}
      >
        {label}
      </TableHead>
    );
  }

  const isActive = sortKey === columnSortKey;

  return (
    <TableHead
      className={cn(
        align === 'right' && 'text-right',
        'text-xs font-semibold uppercase tracking-wider',
        COLUMN_MIN_WIDTHS[columnKey],
      )}
      style={{ width: COLUMN_WIDTHS[columnKey] }}
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSortChange(columnSortKey)}
        title={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1 bg-transparent border-0 p-0 font-inherit cursor-pointer transition-colors',
          isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        {isActive &&
          (sortDirection === 'asc' ? (
            <ChevronUpIcon size={12} className="text-primary" />
          ) : (
            <ChevronDownIcon size={12} className="text-primary" />
          ))}
      </button>
    </TableHead>
  );
}

function DeadlineCell({ bid, nowMs }: { bid: BidSummary; nowMs: number }) {
  if (!isValidDeadline(bid.submissionDeadline)) {
    return <span className="text-muted-foreground">—</span>;
  }

  const { daysLeft, urgency } = getDeadlineInfo(bid.submissionDeadline!, nowMs);

  const label =
    urgency === 'passed' ? 'Window closed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

  const colorClass =
    urgency === 'urgent'
      ? 'text-destructive'
      : urgency === 'soon'
        ? 'text-amber-400'
        : urgency === 'passed'
          ? 'text-muted-foreground'
          : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs font-medium whitespace-nowrap text-foreground">
        {formatDate(bid.submissionDeadline!)}
      </span>
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
          colorClass,
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ReadinessCell({ bid }: { bid: BidSummary }) {
  const { total, approved, pct } = computeReadiness(bid);

  if (total === 0) {
    return <span className="text-[11px] text-muted-foreground">Pending intake</span>;
  }

  const indicatorClass =
    pct !== null && pct >= 80
      ? 'bg-primary'
      : pct !== null && pct >= 50
        ? 'bg-amber-500'
        : 'bg-muted-foreground';

  return (
    <div className="flex flex-col gap-1 w-24">
      <div className="flex justify-between text-[10px] font-semibold">
        <span className="text-foreground">{pct}%</span>
        <span className="text-muted-foreground">
          {approved}/{total}
        </span>
      </div>
      <Progress value={pct ?? 0} indicatorColor={indicatorClass} className="h-1.5 bg-muted" />
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

  const [deleteTarget, setDeleteTarget] = useState<BidSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
            className="flex flex-col gap-0.5 no-underline group max-w-full"
            title={bid.title}
          >
            <span className="text-xs font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 break-words">
              {bid.title}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              № {bid.tenderNumber}
            </span>
          </Link>
        );
      case 'organization':
        return (
          <span
            className="text-xs text-foreground font-medium line-clamp-2 break-words block"
            title={bid.tenderingAuthority}
          >
            {bid.tenderingAuthority}
          </span>
        );
      case 'value':
        return (
          <span className="font-mono text-xs font-semibold text-foreground whitespace-nowrap tabular-nums">
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
          <div className="flex items-center justify-end gap-1">
            <Link to={`/bids/${bid.id}`} className="no-underline">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {getRowActionLabel(bid.status)}
              </Button>
            </Link>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(bid);
                }}
                disabled={isDeleting}
                aria-label={`Delete ${bid.title}`}
                title="Delete tender project"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <TrashIcon size={12} className="mr-1" />
                Delete
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col">
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
        <Table className="w-full min-w-[1100px] table-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-muted/40">
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
                <TableHead
                  style={{ width: COLUMN_WIDTHS.fit }}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    COLUMN_MIN_WIDTHS.fit,
                  )}
                >
                  Fit
                </TableHead>
              )}
              {visibleColumns.includes('recommendation') && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.recommendation }}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    COLUMN_MIN_WIDTHS.recommendation,
                  )}
                >
                  Recommendation
                </TableHead>
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
              <TableHead
                style={{ width: COLUMN_WIDTHS.actions }}
                className={cn(
                  'text-right text-xs font-semibold uppercase tracking-wider',
                  COLUMN_MIN_WIDTHS.actions,
                )}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageBids.map((bid) => (
              <TableRow key={bid.id} className="border-b border-border/60 hover:bg-accent/40">
                {visibleColumns.map((column) => (
                  <TableCell
                    key={column}
                    className={cn(
                      column === 'value' || column === 'actions' ? 'text-right' : 'text-left',
                      'py-3',
                      COLUMN_MIN_WIDTHS[column],
                    )}
                  >
                    {renderCell(bid, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-card border border-border border-t-0 rounded-b-lg text-xs text-muted-foreground shadow-xs">
        <span>
          Showing {range.start}–{range.end} of {bids.length}
          {bids.length !== totalCount ? ` (filtered from ${totalCount})` : ''}
        </span>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Page size */}
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
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
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon size={13} />
            </Button>

            {getPageNumbers(safePage, totalPages).map((pageItem, index) =>
              pageItem === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={pageItem}
                  variant={pageItem === safePage ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 min-w-[28px] px-2 text-xs"
                  onClick={() => setPage(pageItem)}
                  aria-current={pageItem === safePage ? 'page' : undefined}
                >
                  {pageItem}
                </Button>
              ),
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon size={13} />
            </Button>
          </nav>
        </div>
      </div>

      {/* Delete confirmation dialog using shadcn Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Tender Project</DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-foreground">
            <p>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              This permanently removes the tender project, all uploaded documents, and the derived
              compliance matrix. Cloud storage objects are pruned.
            </p>
            {deleteError && <ErrorBanner message={deleteError} />}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Yes, Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
