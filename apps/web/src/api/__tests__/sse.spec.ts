import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const clientMock = vi.hoisted(() => ({
  token: 'jwt-current' as string | null,
  refreshResult: true,
  refreshCalls: 0,
}));

vi.mock('@/api/client.js', () => ({
  getAccessToken: () => clientMock.token,
  resolveUrl: (path: string) => path,
  coordinatedRefresh: async () => {
    clientMock.refreshCalls += 1;
    if (clientMock.refreshResult) clientMock.token = 'jwt-refreshed';
    return clientMock.refreshResult;
  },
}));

import { parseSseBuffer, streamSse, SseHttpError } from '@/api/sse.js';

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('parseSseBuffer', () => {
  it('returns complete events and keeps the partial tail', () => {
    const { events, rest } = parseSseBuffer('data: {"a":1}\n\ndata: {"b"');
    expect(events).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b"');
  });

  it('joins multi-line data, accepts CRLF and ignores comments and other fields', () => {
    const { events } = parseSseBuffer(
      ': keep-alive\r\n\r\nevent: progress\r\ndata: line1\r\ndata: line2\r\n\r\n',
    );
    expect(events).toEqual(['line1\nline2']);
  });
});

describe('streamSse', () => {
  beforeEach(() => {
    clientMock.token = 'jwt-current';
    clientMock.refreshResult = true;
    clientMock.refreshCalls = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the token in the Authorization header, never in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(['data: {"progress":10}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    const messages: string[] = [];

    await streamSse(
      '/api/v1/bids/b1/extraction-progress',
      { onMessage: (d) => messages.push(d) },
      new AbortController().signal,
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/bids/b1/extraction-progress');
    expect(String(url)).not.toContain('token');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-current' });
    expect(messages).toEqual(['{"progress":10}']);
  });

  it('reassembles events split across network chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse(['data: {"step":"PARS', 'ING"}\n', '\ndata: {"step":"DONE"}\n\n']),
        ),
    );
    const messages: string[] = [];

    await streamSse('/s', { onMessage: (d) => messages.push(d) }, new AbortController().signal);

    expect(messages).toEqual(['{"step":"PARSING"}', '{"step":"DONE"}']);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(streamResponse(['data: ok\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    const onOpen = vi.fn();

    await streamSse('/s', { onOpen, onMessage: () => {} }, new AbortController().signal);

    expect(clientMock.refreshCalls).toBe(1);
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer jwt-refreshed',
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('throws SseHttpError with the status when the stream cannot be opened', async () => {
    clientMock.refreshResult = false;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(
      streamSse('/s', { onMessage: () => {} }, new AbortController().signal),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      streamSse('/s', { onMessage: () => {} }, new AbortController().signal),
    ).rejects.toBeInstanceOf(SseHttpError);
  });
});
