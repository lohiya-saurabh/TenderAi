import React, { useState } from 'react';
import { Card } from '../../common/Card.js';
import { InfoIcon, ChevronDownIcon } from '../../common/Icons.js';

interface MissingEndpoint {
  method: string;
  path: string;
  purpose: string;
  blocks: string;
}

/**
 * Documented missing backend endpoints for the tender detail page.
 *
 * Every section on this page renders exclusively from existing
 * APIs: GET /api/v1/bids/:id, GET /api/v1/bids/:id/compliance-items,
 * the document upload/download/delete endpoints, and the
 * compliance review PATCH. The endpoints below do not exist yet —
 * they are recorded here instead of being simulated with invented
 * data (fake company profiles, fabricated verdicts, invented
 * reviewers).
 */
const MISSING_ENDPOINTS: MissingEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/bids/:id/bid-decision',
    purpose:
      'The bid / no-bid recommendation (PURSUE / DO_NOT_PURSUE / REVIEW_REQUIRED) with evidence-backed reasons, produced by the deterministic eligibility engine.',
    blocks:
      '"Should I Bid on This Tender?" renders the verdict framework in a pending state with the real input signals — never a fabricated verdict.',
  },
  {
    method: 'GET',
    path: '/api/v1/company-profile',
    purpose:
      'Company Capability Profile aggregate — registrations, certifications, audited financials, past work orders.',
    blocks:
      'The eligibility engine has no profile to evaluate against, so no verdict, eligibility factor, or readiness pillar can be computed.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/evidence-matches',
    purpose:
      'Company-side evidence mapping: which uploaded company document satisfies each extracted requirement (Evidence Vault + matching engine).',
    blocks:
      'The citation inspector shows the real tender-side grounding (verbatim clause, page, confidence) but no company-side proof document.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/risk-findings',
    purpose:
      'Commercial risk findings — timeline pressure, working-capital lock-in, liquidated-damages exposure analysis.',
    blocks:
      'Risks section shows real statutory obligations and flagged requirements only.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/review-tasks',
    purpose:
      'Dedicated human-in-the-loop review tasks — assignments, SLAs, threaded comments, confirmations.',
    blocks:
      'Review Tasks lists real PENDING / humanReviewRequired requirements deep-linking to the compliance review page.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/readiness',
    purpose:
      'Full 4-pillar bid readiness rollup — evidence completeness, risk clearance, deadline buffer, EMD affordability.',
    blocks:
      'Bid Readiness shows the real requirement-review progress (approved / extracted) only.',
  },
  {
    method: 'GET',
    path: '/api/v1/bids/:id/deadlines',
    purpose:
      'Tender lifecycle deadlines — pre-bid meeting, clarification window, EMD due date, submission freeze.',
    blocks:
      'Only the submission deadline is currently stored on the bid; no derived or invented dates are shown.',
  },
];

export const MissingDataCallout: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      variant="flat"
      padding="sm"
      style={{ border: '1px solid var(--color-surface-border)' }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
          color: 'var(--color-surface-muted)',
          fontSize: 'var(--text-xs)',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <InfoIcon size={14} color="var(--color-primary-400)" />
          <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
            Data Sources &amp; Documented Missing Endpoints
          </span>
        </div>
        <ChevronDownIcon
          size={14}
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {isExpanded && (
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-surface-border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-muted)',
            lineHeight: 1.5,
          }}
        >
          <p style={{ marginBottom: '0.5rem' }}>
            This page renders exclusively from live endpoints:{' '}
            <code style={{ color: 'var(--color-primary-300)' }}>
              GET /api/v1/bids/:id
            </code>
            ,{' '}
            <code style={{ color: 'var(--color-primary-300)' }}>
              GET /api/v1/bids/:id/compliance-items
            </code>
            , document upload/download/delete, and the compliance review
            PATCH. Signals the backend does not expose yet are listed below
            — not simulated.
          </p>
          <div style={{ fontWeight: 600, color: 'var(--color-surface-text)', marginBottom: '0.35rem' }}>
            Missing Target Endpoints ({MISSING_ENDPOINTS.length}):
          </div>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {MISSING_ENDPOINTS.map((endpoint) => (
              <li key={endpoint.path}>
                <code style={{ color: 'var(--color-primary-300)' }}>
                  {endpoint.method} {endpoint.path}
                </code>
                <span> — {endpoint.purpose}</span>
                <span style={{ display: 'block', color: 'var(--color-surface-subtle)', fontSize: 'var(--text-2xs)' }}>
                  Current gap: {endpoint.blocks}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
