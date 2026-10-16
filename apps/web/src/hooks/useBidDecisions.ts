import { useEffect, useRef, useState } from 'react';
import { getBidDecision, type BidDecisionSummary, type BidSummary } from '@/api/bids.js';

export interface BidDecisionsState {
  /** Latest bid decision keyed by bid ID (omits unevaluated bids) */
  decisionsByBid: Record<string, BidDecisionSummary>;
  isLoading: boolean;
  /**
   * Bid IDs whose decision request failed with a real error
   * (network / 5xx). A 404 is the expected "not evaluated yet"
   * state and is NOT recorded here. Sections degrade gracefully:
   * those rows render the honest "Not evaluated" cell.
   */
  failedBidIds: string[];
}

/**
 * Fetches the persisted bid decision for every bid in parallel.
 *
 * Trade-off: this is an N+1 read pattern (one request per bid),
 * identical to useBidComplianceItems. It is acceptable at current
 * pipeline scale and uses only the existing
 * GET /api/v1/bids/:id/bid-decision endpoint; the documented
 * replacement is embedding the decision projection in
 * GET /api/v1/bids (see MissingApiCallout).
 *
 * The effect is keyed on the bid-ID set (not bid object identity)
 * so filtering, sorting, and refetches with an unchanged bid set
 * do not re-fire requests.
 */
export function useBidDecisions(bids: BidSummary[] | null): BidDecisionsState {
  const [state, setState] = useState<BidDecisionsState>({
    decisionsByBid: {},
    isLoading: false,
    failedBidIds: [],
  });
  const requestSeq = useRef(0);

  const bidKey = (bids || []).map((b) => b.id).join(',');

  useEffect(() => {
    const seq = ++requestSeq.current;
    const bidList = bids || [];

    if (bidList.length === 0) {
      setState({ decisionsByBid: {}, isLoading: false, failedBidIds: [] });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    // getBidDecision never rejects (api client normalizes errors into
    // ApiResult), so Promise.all is safe and preserves per-bid failure info.
    void Promise.all(
      bidList.map((bid) => getBidDecision(bid.id).then((result) => ({ bidId: bid.id, result }))),
    ).then((entries) => {
      // Drop stale responses if the bid set changed mid-flight
      if (cancelled || seq !== requestSeq.current) return;

      const decisionsByBid: Record<string, BidDecisionSummary> = {};
      const failedBidIds: string[] = [];
      for (const { bidId, result } of entries) {
        if (result.ok) {
          decisionsByBid[bidId] = result.data;
        } else if (result.error.status !== 404) {
          // 404 = no decision evaluated yet (expected); anything
          // else is a genuine failure worth surfacing.
          failedBidIds.push(bidId);
        }
      }
      setState({ decisionsByBid, isLoading: false, failedBidIds });
    });

    return () => {
      cancelled = true;
    };
    // Refetch only when the set of bid IDs changes
  }, [bidKey]);

  return state;
}
