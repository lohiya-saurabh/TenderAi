import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@/components/common/Icons.js';
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface ColumnSorterProps {
  columnKey: string;
  label: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
}

export const ColumnSorter: React.FC<ColumnSorterProps> = ({
  columnKey,
  label,
  currentSort,
  onSort,
}) => {
  const isActive = currentSort.key === columnKey;
  const direction = currentSort.direction;

  return (
    <button
      onClick={() => onSort(columnKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: isActive ? 'var(--color-primary-500)' : 'var(--color-surface-muted)',
        padding: '0.25rem 0',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        textAlign: 'left',
      }}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      {isActive && (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          {direction === 'asc' ? (
            <ChevronUpIcon size={10} color="var(--color-primary-500)" />
          ) : (
            <ChevronDownIcon size={10} color="var(--color-primary-500)" />
          )}
        </span>
      )}
      {!isActive && (
        <span style={{ opacity: 0.3, display: 'flex' }}>
          <ChevronUpIcon size={10} color="var(--color-surface-muted)" />
        </span>
      )}
    </button>
  );
};
