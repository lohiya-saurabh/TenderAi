/**
 * TenderPulse AI — Authenticated Server-Sent Events over fetch
 *
 * Native EventSource cannot send an Authorization header, which pushed the JWT into
 * the URL (?token=...) where proxies, access logs and browser history keep it. This
 * reader streams the same text/event-stream response over fetch with the normal
 * Bearer header, so the token never appears in a URL. It also works cross-origin
 * without relying on third-party cookies.
 */

import { coordinatedRefresh, getAccessToken, resolveUrl } from '@/api/client.js';

export interface SseHandlers {
  onOpen?: () => void;
  /** Receives each event's `data` payload (multi-line data joined with "\n"). */
  onMessage: (data: string) => void;
}

/** Thrown for a non-2xx response; `status` lets callers stop retrying on auth errors. */
export class SseHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Event stream request failed with status ${status}`);
  }
}

/**
 * Splits buffered stream text into complete SSE events. Returns the `data` payloads of
 * finished events and the trailing partial text to keep for the next chunk.
 */
export function parseSseBuffer(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n?/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: string[] = [];
  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));
    if (dataLines.length > 0) {
      events.push(dataLines.join('\n'));
    }
  }
  return { events, rest };
}

async function openStream(url: string, signal: AbortSignal): Promise<Response> {
  const request = () => {
    const token = getAccessToken();
    return fetch(resolveUrl(url), {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  };

  let response = await request();
  if (response.status === 401 && (await coordinatedRefresh())) {
    response = await request();
  }
  return response;
}

/**
 * Opens one event stream and resolves when the server ends it (or the signal aborts).
 * Rejects on network failure or a non-2xx status (SseHttpError).
 */
export async function streamSse(
  url: string,
  handlers: SseHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await openStream(url, signal);
  if (!response.ok || !response.body) {
    throw new SseHttpError(response.status);
  }
  handlers.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBuffer(buffer);
      buffer = rest;
      for (const data of events) {
        if (signal.aborted) return;
        handlers.onMessage(data);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
