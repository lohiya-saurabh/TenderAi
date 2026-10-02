import { useState, useEffect, useCallback } from 'react';
import type { ApiResult, ApiError } from '../api/client.js';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Generic data fetching hook with loading, error, and refetch capabilities.
 */
export function useApi<T>(
  fetcher: () => Promise<ApiResult<T>>,
  deps: unknown[] = [],
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await fetcher();
      if (result.ok) {
        setState({ data: result.data, isLoading: false, error: null });
      } else {
        setState({ data: null, isLoading: false, error: result.error });
      }
    } catch (err) {
      setState({
        data: null,
        isLoading: false,
        error: {
          status: 0,
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
        },
      });
    }
  }, [fetcher]);

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = (updater: React.SetStateAction<T | null>) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === 'function' ? (updater as (prev: T | null) => T | null)(prev.data) : updater,
    }));
  };

  return {
    ...state,
    refetch: execute,
    setData,
  };
}
