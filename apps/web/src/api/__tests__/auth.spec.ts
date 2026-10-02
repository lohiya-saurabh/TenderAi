import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, refreshTokens, logout } from '../auth.js';
import { clearTokens, getAccessToken } from '../client.js';

describe('Auth API', () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it('performs login successfully and returns tokens and user', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'bidmanager@acme.com',
      name: 'Bid Manager',
      role: 'BID_MANAGER',
      permissions: ['bids:read', 'bids:create', 'compliance:review'],
      organizationId: 'org-1',
      organizationName: 'Acme Infra Ltd',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        user: mockUser,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await login('bidmanager@acme.com', 'password123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.email).toBe('bidmanager@acme.com');
      expect(result.data.user.role).toBe('BID_MANAGER');
      expect(result.data.accessToken).toBe('access-123');
    }
  });

  it('handles login failure gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await login('bad@user.com', 'wrong');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(401);
      expect(result.error.message).toBe('Invalid credentials');
    }
  });

  it('refreshes token via auth refresh endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await refreshTokens('valid-refresh');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accessToken).toBe('new-access-token');
      expect(result.data.refreshToken).toBe('new-refresh-token');
    }
  });

  it('clears tokens upon logout', () => {
    logout();
    expect(getAccessToken()).toBeNull();
  });
});
