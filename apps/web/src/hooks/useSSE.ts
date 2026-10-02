import { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '../api/client.js';

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
 */
export function useSSE(url: string | null): UseSSEReturn {
  const [lastEvent, setLastEvent] = useState<SSEProgressEvent | null>(null);
  const [events, setEvents] = useState<SSEProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    // Append token if available for authenticated SSE endpoint
    const token = getAccessToken();
    const sseUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${token}` : url;

    const es = new EventSource(sseUrl);
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
      } catch (err) {
        console.error('Failed to parse SSE event data', err);
      }
    };

    es.onerror = () => {
      setError('Connection lost. Reconnecting...');
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [url]);

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  return {
    lastEvent,
    events,
    isConnected,
    error,
    close,
  };
}
