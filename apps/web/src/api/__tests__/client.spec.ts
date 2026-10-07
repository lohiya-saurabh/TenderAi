import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiGet,
  setTokens,
  clearTokens,
  getAccessToken,
  setOnAuthExpired,
} from '../client.js';

describe('API Client', () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manages access and refresh tokens correctly', () => {
    setTokens('mock-access-token', 'mock-refresh-token');
    expect(getAccessToken()).toBe('mock-access-token');

    clearTokens();
    expect(getAccessToken()).toBeNull();
  });

  it('attaches Authorization header when access token is present', async () => {
    setTokens('jwt-12345', 'refresh-12345');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiGet<{ success: boolean }>('/api/v1/test');

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-12345',
        }),
      }),
    );
  });

  it('returns structured ApiError on 4xx/5xx responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Bid not found' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiGet('/api/v1/bids/non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(404);
      expect(result.error.message).toBe('Bid not found');
    }
  });

  it('handles automatic 401 refresh retry', async () => {
    setTokens('expired-access', 'valid-refresh');

    const mockFetch = vi.fn()
      // First call fails with 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      // Refresh call succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
      })
      // Retried original call succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'protected-data' }),
      });

    vi.stubGlobal('fetch', mockFetch);

    const result = await apiGet<{ data: string }>('/api/v1/protected');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ data: 'protected-data' });
    }
    expect(getAccessToken()).toBe('new-access-token');
  });

  it('calls onAuthExpired when 401 refresh fails', async () => {
    setTokens('expired-access', 'invalid-refresh');

    const onExpired = vi.fn();
    setOnAuthExpired(onExpired);

    const mockFetch = vi.fn()
      // First call 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      // Refresh call fails
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

    vi.stubGlobal('fetch', mockFetch);

    const result = await apiGet('/api/v1/protected');

    expect(result.ok).toBe(false);
    expect(onExpired).toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it('proactively refreshes token on cold start when in-memory accessToken is null but refresh token exists', async () => {
    // Simulate page reload: stub localStorage with refresh token, in-memory accessToken remains null
    const storageData: Record<string, string> = {
      tp_refresh_token: 'persisted-refresh-token',
    };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storageData[k] ?? null,
      setItem: (k: string, v: string) => { storageData[k] = v; },
      removeItem: (k: string) => { delete storageData[k]; },
    });

    const mockFetch = vi.fn()
      // Proactive refresh call
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'restored-access-token',
          refreshToken: 'rotated-refresh-token',
        }),
      })
      // Actual protected API call with refreshed token
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 'comp_1', legalName: 'ACR' }],
      });

    vi.stubGlobal('fetch', mockFetch);

    const result = await apiGet<Array<{ id: string }>>('/api/v1/companies');

    expect(result.ok).toBe(true);
    // Verified: First call was refresh, second call had the Bearer token, NEVER sent unauthenticated call
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'persisted-refresh-token' }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/companies',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer restored-access-token',
        }),
      }),
    );
    expect(getAccessToken()).toBe('restored-access-token');
  });
});
