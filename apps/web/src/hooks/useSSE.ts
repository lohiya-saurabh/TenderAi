import { useState, useEffect, useRef, useCallback } from 'react';
import { SseHttpError, streamSse } from '@/api/sse.js';

export interface SSEProgressEvent {
  step: string;
  progress: number;
  message?: string;
  status?: string;
  details?: Record<string, unknown>;
}

interface UseSSEReturn {
  lastEvent: SSEProgressEvent | null;
  events: SSEProgressEvent[];
  isConnected: boolean;
  error: string | null;
  close: () => void;
}

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 15000;

/**
 * Hook for subscribing to Server-Sent Events (SSE) for document extraction progress.
 * Streams over fetch with the Bearer header (the token never goes in the URL),
 * reconnects with capped backoff like EventSource did, and stops for good once a
 * terminal state (COMPLETED or 100%) arrives, close() is called, or auth fails.
 */
export function useSSE(url: string | null): UseSSEReturn {
  const [lastEvent, setLastEvent] = useState<SSEProgressEvent | null>(null);
  const [events, setEvents] = useState<SSEProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  const close = useCallback(() => {
    isTerminatedRef.current = true;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    isTerminatedRef.current = false;
    const controller = new AbortController();
    controllerRef.current = controller;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = INITIAL_RETRY_MS;

    const handleMessage = (raw: string) => {
      try {
        const data = JSON.parse(raw) as SSEProgressEvent;
        setLastEvent(data);
        setEvents((prev) => [...prev, data]);

        // Terminal state: stop here so the stream is not reopened.
        if (data.step === 'COMPLETED' || data.progress >= 100) {
          isTerminatedRef.current = true;
          controller.abort();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    const connect = async () => {
      try {
        await streamSse(
          url,
          {
            onOpen: () => {
              retryDelay = INITIAL_RETRY_MS;
              setIsConnected(true);
              setError(null);
            },
            onMessage: handleMessage,
          },
          controller.signal,
        );
      } catch (err) {
        if (isTerminatedRef.current || controller.signal.aborted) return;
        if (err instanceof SseHttpError && (err.status === 401 || err.status === 403)) {
          isTerminatedRef.current = true;
          setIsConnected(false);
          setError('Not authorised to view progress. Please sign in again.');
          return;
        }
      }
      if (isTerminatedRef.current || controller.signal.aborted) {
        setIsConnected(false);
        return;
      }
      // Stream ended or dropped before a terminal event: reconnect with backoff.
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    };

    void connect();

    return () => {
      isTerminatedRef.current = true;
      clearTimeout(retryTimer);
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
      setIsConnected(false);
    };
  }, [url]);

  return {
    lastEvent,
    events,
    isConnected,
    error,
    close,
  };
}
