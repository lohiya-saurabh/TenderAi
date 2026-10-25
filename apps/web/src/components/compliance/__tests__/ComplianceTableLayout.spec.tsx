import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ComplianceTable } from '../ComplianceTable.js';
import { ComplianceRow } from '../ComplianceRow.js';
import type { ComplianceItem } from '@/api/compliance.js';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext.js';
import fs from 'node:fs';
import path from 'node:path';

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'user-layout-1',
    email: 'tester@tenderpulse.internal',
    role: 'PROPOSAL_MANAGER',
    companyId: 'comp-tester',
    name: 'Layout Tester',
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  hasPermission: () => true,
  hasRole: () => true,
};

function render(element: React.ReactElement): string {
  const wrapped = React.createElement(
    AuthContext.Provider,
    { value: mockAuthValue },
    element,
  );
  return renderToString(wrapped).replace(/<!-- -->/g, '');
}

const mockItem: ComplianceItem = {
  id: 'item-layout-001',
  bidId: 'bid-layout-123',
  requirement: 'Minimum 5 years prior experience in highway construction',
  category: 'TECHNICAL',
  subCategory: 'Technical Qualification',
  isMandatory: true,
  tenderClauseRef: 'Clause 4.2.1',
  status: 'PASS',
  companyEvidence: {
    id: 'ev-1',
    title: 'Highway Completion Certificate',
    status: 'VERIFIED',
  },
  risk: {
    level: 'LOW',
    category: 'TECHNICAL',
    summary: 'Criteria met with 7 years verified experience.',
  },
  provenance: {
    documentId: 'doc-nit-01',
    documentName: 'NIT.pdf',
    pageNumber: 12,
    verbatimQuote: 'Minimum 5 years prior experience in highway construction.',
  },
  sourceCitation: {
    document: 'NIT.pdf',
    page: 12,
    verbatimQuote: 'Minimum 5 years prior experience in highway construction.',
  },
  humanReviewRequired: false,
};

describe('Compliance Matrix Table Horizontal Scrolling & Layout (F11)', () => {
  it('should render ComplianceTable with min-w-0 max-w-full and touch-pan-x scrollbar-thin container', () => {
    const html = render(React.createElement(ComplianceTable, { items: [mockItem] }));

    // Verify root container has flex flex-col w-full min-w-0 max-w-full
    expect(html).toContain('flex flex-col w-full min-w-0 max-w-full');

    // Verify scroll wrapper has overflow-x-auto, overscroll-x-contain, touch-pan-x, scrollbar-thin
    expect(html).toContain('w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-thin');

    // Verify inner table wrapper has min-w-[1050px]
    expect(html).toContain('min-w-[1050px]');

    // Verify header band uses responsive minmax and fr tracks without clipping
    expect(html).toContain(
      'grid-cols-[minmax(270px,3.2fr)_minmax(100px,1.1fr)_minmax(80px,0.9fr)_minmax(170px,1.8fr)_minmax(120px,1.2fr)_minmax(95px,1fr)_minmax(85px,0.9fr)]',
    );

    // Verify obsolete percentage-only tracks that caused 112px overflow are eliminated
    expect(html).not.toContain('grid-cols-[30%_11%_8%_18%_13%_10%_10%]');
  });

  it('should render ComplianceRow with responsive minmax tracks matching header', () => {
    const html = render(
      React.createElement(ComplianceRow, {
        item: mockItem,
        isExpanded: false,
        onToggleExpand: vi.fn(),
      }),
    );

    // Verify row has the exact matching responsive minmax track calculation
    expect(html).toContain(
      'grid-cols-[minmax(270px,3.2fr)_minmax(100px,1.1fr)_minmax(80px,0.9fr)_minmax(170px,1.8fr)_minmax(120px,1.2fr)_minmax(95px,1fr)_minmax(85px,0.9fr)]',
    );

    // Verify obsolete percentage-only tracks are eliminated
    expect(html).not.toContain('grid-cols-[30%_11%_8%_18%_13%_10%_10%]');
  });

  it('should anchor expanded detail panel with sticky left-0 max-w-full so content stays visible during scroll', () => {
    const html = render(
      React.createElement(ComplianceRow, {
        item: mockItem,
        isExpanded: true,
        onToggleExpand: vi.fn(),
      }),
    );

    // Verify expanded detail panel has sticky left-0 max-w-full
    expect(html).toContain('sticky left-0 max-w-full');
  });

  it('should define .scrollbar-thin in index.css with touch momentum scrolling', () => {
    const cssPath = path.resolve(__dirname, '../../../index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('.scrollbar-thin');
    expect(css).toContain('scrollbar-width: thin;');
    expect(css).toContain('-webkit-overflow-scrolling: touch;');
    expect(css).toContain('.scrollbar-thin::-webkit-scrollbar');
    expect(css).toContain('.scrollbar-thin::-webkit-scrollbar-thumb');
  });
});
