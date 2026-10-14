import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken, resolveUrl } from '../api/client.js';

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

/**
 * Hook for subscribing to Server-Sent Events (SSE) for document extraction progress.
 * Prevents native EventSource auto-reconnect loops once terminal states (COMPLETED or 100%)
 * are reached or when close() is explicitly called.
 */
export function useSSE(url: string | null): UseSSEReturn {
  const [lastEvent, setLastEvent] = useState<SSEProgressEvent | null>(null);
  const [events, setEvents] = useState<SSEProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  const close = useCallback(() => {
    isTerminatedRef.current = true;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    isTerminatedRef.current = false;

    // Append token if available for authenticated SSE endpoint
    const resolvedUrl = resolveUrl(url);
    const token = getAccessToken();
    const sseUrl = token ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}token=${token}` : resolvedUrl;

    const es = new EventSource(sseUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEProgressEvent;
        setLastEvent(data);
        setEvents((prev) => [...prev, data]);

        // If completion or 100% progress is reached, immediately close to prevent native auto-reconnect
        if (data.step === 'COMPLETED' || data.progress >= 100) {
          isTerminatedRef.current = true;
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    es.onerror = () => {
      // If the stream was terminated normally upon completion or closed explicitly, do not treat as an error
      if (isTerminatedRef.current) {
        es.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        return;
      }
      setError('Connection lost. Reconnecting...');
      setIsConnected(false);
    };

    return () => {
      isTerminatedRef.current = true;
      es.close();
      eventSourceRef.current = null;
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
