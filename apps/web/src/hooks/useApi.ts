import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResult, ApiError } from '@/api/client.js';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  isValidating: boolean;
  error: ApiError | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Generic data fetching hook with loading, error, and refetch capabilities.
 * Follows stale-while-revalidate pattern: subsequent refetch calls do not
 * clear existing data or reset `isLoading` to true, avoiding UI flashing.
 *
 * The fetcher receives an AbortSignal. Starting a new request (dependency
 * change or refetch) or unmounting aborts the previous in-flight request,
 * and a request-id guard drops any response that still resolves late, so
 * a slow earlier response can never overwrite newer data.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<ApiResult<T>>,
  deps: unknown[] = [],
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    isValidating: true,
    error: null,
  });

  const isInitialMount = useRef(true);
  const activeRequestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const currentId = ++activeRequestId.current;
    setState((prev) => ({
      ...prev,
      isLoading: prev.data === null,
      isValidating: true,
      error: null,
    }));
    try {
      const result = await fetcher(controller.signal);
      if (currentId !== activeRequestId.current || controller.signal.aborted) return;
      if (result.ok) {
        setState({ data: result.data, isLoading: false, isValidating: false, error: null });
      } else {
        setState((prev) => ({
          data: prev.data,
          isLoading: false,
          isValidating: false,
          error: result.error,
        }));
      }
    } catch (err) {
      if (currentId !== activeRequestId.current || controller.signal.aborted) return;
      setState((prev) => ({
        data: prev.data,
        isLoading: false,
        isValidating: false,
        error: {
          status: 0,
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
        },
      }));
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  }, [fetcher]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      // Route or dependencies changed: reset state for cold load of new entity
      setState({
        data: null,
        isLoading: true,
        isValidating: true,
        error: null,
      });
    }
    execute();
  }, deps);

  // Abort whatever is still in flight when the component unmounts.
  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    [],
  );

  const setData = (updater: React.SetStateAction<T | null>) => {
    setState((prev) => ({
      ...prev,
      data:
        typeof updater === 'function'
          ? (updater as (prev: T | null) => T | null)(prev.data)
          : updater,
    }));
  };

  return {
    ...state,
    refetch: execute,
    setData,
  };
}
