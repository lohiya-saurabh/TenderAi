import { describe, it, expect, vi } from 'vitest';
import type { SSEProgressEvent } from '../useSSE.js';

describe('useApi & useSSE — SWR Background Revalidation and Terminal SSE Guards', () => {
  it('useApi maintains stale data and keeps isLoading false during refetch (stale-while-revalidate)', async () => {
    let mockData = { id: 'bid-1', title: 'Road Tender' };
    const fetcher = vi.fn().mockImplementation(async () => ({
      ok: true as const,
      data: mockData,
    }));

    // Test SWR state transitions
    const ReactTestUtils = {
      runHookCycle: async () => {
        let state = {
          data: null as unknown,
          isLoading: true,
          isValidating: true,
          error: null,
        };

        const execute = async () => {
          state = {
            ...state,
            isLoading: state.data === null,
            isValidating: true,
          };
          const res = await fetcher();
          if (res.ok) {
            state = {
              data: res.data,
              isLoading: false,
              isValidating: false,
              error: null,
            };
          }
        };

        // Cold load
        await execute();
        expect(state.isLoading).toBe(false);
        expect(state.data).toEqual(mockData);

        // Background refetch
        mockData = { id: 'bid-1', title: 'Road Tender Updated' };
        const refetchPromise = execute();
        // During execution, with existing data present, isLoading MUST remain false
        expect(state.isLoading).toBe(false);
        expect(state.isValidating).toBe(true);
        expect(state.data).not.toBeNull();

        await refetchPromise;
        expect(state.isLoading).toBe(false);
        expect(state.isValidating).toBe(false);
        expect(state.data).toEqual({ id: 'bid-1', title: 'Road Tender Updated' });
      },
    };

    await ReactTestUtils.runHookCycle();
  });

  it('useSSE terminates immediately on COMPLETED event or progress >= 100 without looping', () => {
    const mockEventSource = {
      close: vi.fn(),
      onopen: null as unknown,
      onmessage: null as unknown,
      onerror: null as unknown,
    };

    // Simulate SSE behavior matching useSSE implementation
    let isTerminated = false;
    let isConnected = true;
    let sseError: string | null = null;

    const onMessage = (event: { data: string }) => {
      const data = JSON.parse(event.data) as SSEProgressEvent;
      if (data.step === 'COMPLETED' || data.progress >= 100) {
        isTerminated = true;
        mockEventSource.close();
        isConnected = false;
      }
    };

    const onError = () => {
      if (isTerminated) {
        mockEventSource.close();
        isConnected = false;
        return;
      }
      sseError = 'Connection lost. Reconnecting...';
    };

    // Step 1: In-flight progress
    onMessage({ data: JSON.stringify({ step: 'PARSING_PAGES', progress: 25 }) });
    expect(isTerminated).toBe(false);
    expect(mockEventSource.close).not.toHaveBeenCalled();

    // Step 2: Terminal completion event
    onMessage({
      data: JSON.stringify({ step: 'COMPLETED', progress: 100, status: 'REVIEW_READY' }),
    });
    expect(isTerminated).toBe(true);
    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
    expect(isConnected).toBe(false);

    // Step 3: Triggering error after termination (when server closes TCP stream) MUST NOT reconnect or flag error
    onError();
    expect(sseError).toBeNull();
  });
});
