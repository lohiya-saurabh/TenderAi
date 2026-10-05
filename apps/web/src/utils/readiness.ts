/**
 * TenderPulse AI — Readiness & Risk Utilities
 *
 * Shared, pure rollups over the existing API contract
 * (BidSummary / requirement counts). Used by the dashboard
 * tender list and the tender detail page.
 */

import type { BidSummary } from '../api/bids.js';

export interface ReadinessSummary {
  total: number;
  approved: number;
  flagged: number;
  /** approved / total as a percentage, or null when no requirements are extracted yet */
  pct: number | null;
}

/**
 * Readiness = approved requirements / total extracted requirements.
 * Returns pct = null (not 0%) when nothing has been extracted — an empty
 * matrix is "pending intake", not "0% ready".
 */
export function computeReadiness(bid: Pick<BidSummary, 'totalRequirements' | 'approvedRequirements' | 'flaggedRequirements'>): ReadinessSummary {
  const total = bid.totalRequirements || 0;
  const approved = bid.approvedRequirements || 0;
  const flagged = bid.flaggedRequirements || 0;
  return {
    total,
    approved,
    flagged,
    pct: total > 0 ? Math.round((approved / total) * 100) : null,
  };
}

export type DashboardRiskLevel = 'LOW' | 'HIGH' | 'CRITICAL';

/**
 * Risk rollup from flagged requirement counts. Thresholds are shared
 * across the dashboard and detail page so they never disagree:
 * 0 flagged → LOW, 1–2 → HIGH, ≥3 → CRITICAL.
 */
export function computeRiskLevel(
  bid: Pick<BidSummary, 'flaggedRequirements'>,
): DashboardRiskLevel {
  const flagged = bid.flaggedRequirements || 0;
  if (flagged >= 3) return 'CRITICAL';
  if (flagged > 0) return 'HIGH';
  return 'LOW';
}
