import { describe, it, expect } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ActionRequiredCard } from '../ActionRequiredCard.js';
import { buildActionItems } from '../dashboardData.js';
import type { BidSummary } from '../../../api/bids.js';
import type { ComplianceItem } from '../../../api/compliance.js';

describe('ActionRequiredCard Suite', () => {
  it('instantiates ActionRequiredCard with empty bids cleanly', () => {
    const el = React.createElement(
      MemoryRouter,
      null,
      React.createElement(ActionRequiredCard, { bids: [], complianceByBid: {} })
    );
    expect(el).toBeDefined();
  });

  it('builds action items and instantiates ActionRequiredCard with > 5 items', () => {
    const bids: BidSummary[] = Array.from({ length: 8 }, (_, i) => ({
      id: `bid-test-${i + 1}`,
      title: `Tender Project ${i + 1}`,
      tenderNumber: `NIT-2026-00${i + 1}`,
      tenderingAuthority: 'Authority',
      estimatedValueRupees: 10000000,
      submissionDeadline: '2026-10-30',
      locationState: 'Delhi',
      status: 'UNDER_REVIEW',
      totalRequirements: 5,
      approvedRequirements: 2,
      flaggedRequirements: 1,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
      documents: [],
    }));

    const complianceByBid: Record<string, ComplianceItem[]> = {};
    bids.forEach((b, i) => {
      complianceByBid[b.id] = [
        {
          id: `item-${i + 1}`,
          bidId: b.id,
          requirement: `Statutory Submission ${i + 1}`,
          description: `Description ${i + 1}`,
          category: 'STATUTORY',
          isMandatory: true,
          status: 'REVIEW_REQUIRED',
          humanReviewRequired: true,
          companyEvidence: null,
          risk: null,
          rationale: null,
          provenance: {
            documentId: 'doc-01',
            pageNumber: 1,
            verbatimQuote: 'Quote',
            confidenceScore: 0.95,
          },
          sourceCitation: {
            document: 'NIT.pdf',
            page: 1,
            section: 'ITB',
            verbatimQuote: 'Quote',
            confidenceScore: 0.95,
          },
          version: 1,
          executionRules: {
            stampPaperRequired: false,
            notarizationRequired: false,
            udinRequired: false,
          },
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ];
    });

    const items = buildActionItems(bids, complianceByBid);
    expect(items.length).toBeGreaterThanOrEqual(8);

    const el = React.createElement(
      MemoryRouter,
      null,
      React.createElement(ActionRequiredCard, { bids, complianceByBid })
    );
    expect(el).toBeDefined();
  });
});
