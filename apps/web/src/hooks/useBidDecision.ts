import { useEffect, useState } from 'react';
import { getBidDecision, type BidDecisionSummary, type ApiResult } from '@/api/bids.js';

/**
 * Fetches the persisted bid decision for a single tender.
 *
 * Returns the decision when evaluated, null when not yet evaluated (404),
 * and throws/surfaces errors for genuine failures (network, 5xx).
 *
 * The 404 "not evaluated yet" is the expected state when no evaluation
 * has been run — not an error condition.
 */
export function useBidDecision(bidId: string | undefined): {
  decision: BidDecisionSummary | null;
  isLoading: boolean;
  error: string | null;
} {
  const [decision, setDecision] = useState<BidDecisionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bidId) {
      setDecision(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getBidDecision(bidId).then((result: ApiResult<BidDecisionSummary>) => {
      if (cancelled) return;

      if (result.ok) {
        if (result.data) setDecision(result.data);
      } else {
        const apiError = result.error;
        if (apiError?.status === 404) {
          // Not evaluated yet — expected state, not an error
          setDecision(null);
        } else {
          setError(apiError?.message ?? 'Unknown error');
        }
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bidId]);

  return { decision, isLoading, error };
}
