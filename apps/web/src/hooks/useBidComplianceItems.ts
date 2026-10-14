import { useEffect, useRef, useState } from 'react';
import { listComplianceItems, type ComplianceItem } from '../api/compliance.js';
import type { BidSummary } from '../api/bids.js';

export interface BidComplianceState {
  /** Compliance items keyed by bid ID */
  itemsByBid: Record<string, ComplianceItem[]>;
  isLoading: boolean;
  /**
   * Bid IDs whose per-bid compliance fetch failed. Dashboard sections degrade
   * gracefully: those bids still contribute bid-level aggregate signals
   * (flaggedRequirements counts) even without clause-level detail.
   */
  failedBidIds: string[];
}

/**
 * Fetches compliance items for every non-archived bid in parallel.
 *
 * Trade-off: this is an N+1 read pattern (one request per active bid). It is
 * acceptable at current pipeline scale and uses only existing endpoints; the
 * documented replacement is a tenant-level aggregation endpoint
 * (GET /api/v1/dashboard/action-items — see MissingApiCallout).
 *
 * The effect is keyed on the bid-ID set (not bid object identity) so normal
 * re-renders and refetches with an unchanged bid set do not re-fire requests.
 */
export function useBidComplianceItems(bids: BidSummary[] | null): BidComplianceState {
  const [state, setState] = useState<BidComplianceState>({
    itemsByBid: {},
    isLoading: false,
    failedBidIds: [],
  });
  const requestSeq = useRef(0);

  const activeBids = (bids || []).filter((b) => b.status !== 'ARCHIVED');
  const bidKey = activeBids.map((b) => b.id).join(',');

  useEffect(() => {
    const seq = ++requestSeq.current;

    if (activeBids.length === 0) {
      setState({ itemsByBid: {}, isLoading: false, failedBidIds: [] });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    const bidIds = activeBids.map((bid) => bid.id);

    // listComplianceItems never rejects (api client normalizes errors into
    // ApiResult), so Promise.all is safe and preserves per-bid failure info.
    void Promise.all(
      bidIds.map((bidId) => listComplianceItems(bidId).then((result) => ({ bidId, result }))),
    ).then((entries) => {
      // Drop stale responses if the bid set changed mid-flight
      if (cancelled || seq !== requestSeq.current) return;

      const itemsByBid: Record<string, ComplianceItem[]> = {};
      const failedBidIds: string[] = [];
      for (const { bidId, result } of entries) {
        if (result.ok) {
          const seen = new Set<string>();
          const deduped: ComplianceItem[] = [];
          for (const item of result.data) {
            const title = (item as { title?: string }).title || item.requirement || '';
            const key = `${(item.category || '').toLowerCase()}:${title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(item);
            }
          }
          itemsByBid[bidId] = deduped;
        } else {
          failedBidIds.push(bidId);
        }
      }
      setState({ itemsByBid, isLoading: false, failedBidIds });
    });

    return () => {
      cancelled = true;
    };
    // Refetch only when the set of active bid IDs changes
  }, [bidKey]);

  return state;
}
