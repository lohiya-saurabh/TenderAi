import React, { useState, useMemo } from 'react';
import type { ComplianceItem } from '../../api/compliance.js';
import { ComplianceRow } from './ComplianceRow.js';
import { StatusFilter, type ComplianceStatusFilterValue } from './StatusFilter.js';
import { EmptyState } from '../common/EmptyState.js';

export interface ComplianceTableProps {
  items: ComplianceItem[];
  onReviewItem: (itemId: string, status: 'READY' | 'FLAGGED' | 'WAIVED', notes?: string) => Promise<void>;
}

export const ComplianceTable: React.FC<ComplianceTableProps> = ({
  items,
  onReviewItem,
}) => {
  const [filter, setFilter] = useState<ComplianceStatusFilterValue>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const counts = useMemo(() => {
    return {
      ALL: items.length,
      FLAGGED: items.filter((i) => i.status === 'FLAGGED').length,
      READY: items.filter((i) => i.status === 'READY').length,
      PENDING: items.filter((i) => i.status === 'PENDING').length,
      WAIVED: items.filter((i) => i.status === 'WAIVED').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesFilter = filter === 'ALL' || item.status === filter;
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [items, filter, searchQuery]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📑"
        title="No compliance items extracted yet"
        description="Upload a Notice Inviting Tender (NIT) PDF above to extract mandatory compliance clauses."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Controls toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <StatusFilter value={filter} onChange={setFilter} counts={counts} />

        <input
          type="text"
          placeholder="Search compliance requirements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: 'var(--color-surface-input)',
            color: 'var(--color-surface-text)',
            border: '1px solid var(--color-surface-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 0.75rem',
            fontSize: '0.85rem',
            outline: 'none',
            minWidth: '220px',
          }}
        />
      </div>

      {/* Item list */}
      {filteredItems.length === 0 ? (
        <EmptyState
          title="No items match your filter"
          description="Try selecting a different status filter or clearing your search term."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map((item) => (
            <ComplianceRow key={item.id} item={item} onReview={onReviewItem} />
          ))}
        </div>
      )}
    </div>
  );
};
