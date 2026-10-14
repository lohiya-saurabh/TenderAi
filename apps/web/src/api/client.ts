/**
 * TenderPulse AI — API Client
 *
 * Centralized fetch wrapper with:
 * - JWT access token injection via Authorization header
 * - Automatic 401 → silent refresh → retry
 * - Structured error responses
 * - No tenant_id, role, or document_id sent from the client
 *
 * SECURITY: The frontend NEVER sends tenant_id, role, or document_id
 * in request bodies. The backend derives these from the JWT.
 */

/** Structured API error returned to consumers */
export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

/** Result type for API calls */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// In-memory access token (never in localStorage — XSS protection)
let accessToken: string | null = null;
let fallbackRefreshToken: string | null = null;

// Refresh token stored in localStorage (acceptable trade-off for SPA persistence)
const REFRESH_TOKEN_KEY = 'tp_refresh_token';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage
  ) {
    return globalThis.localStorage as Storage;
  }
  return null;
}

// Flag to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Callback to clear auth state (set by AuthProvider)
let onAuthExpired: (() => void) | null = null;

/** Set the callback invoked when auth is irrecoverably expired */
export function setOnAuthExpired(callback: () => void): void {
  onAuthExpired = callback;
}

/** Store tokens after login or refresh */
export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  const storage = getStorage();
  if (storage) {
    storage.setItem(REFRESH_TOKEN_KEY, refresh);
  } else {
    fallbackRefreshToken = refresh;
  }
}

/** Get the current access token (for SSE connections that need it in URL) */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Clear all tokens on logout */
export function clearTokens(): void {
  accessToken = null;
  fallbackRefreshToken = null;
  inFlightGetRequests.clear();
  const storage = getStorage();
  if (storage) {
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/** Get stored refresh token */
function getRefreshToken(): string | null {
  const storage = getStorage();
  return storage ? storage.getItem(REFRESH_TOKEN_KEY) : fallbackRefreshToken;
}

/**
 * Attempt a silent token refresh.
 * Returns true if refresh succeeded, false otherwise.
 */
async function attemptRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      credentials: 'include',
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken || refreshToken || '');
    return true;
  } catch {
    return false;
  }
}

/**
 * Coordinated refresh: ensures only one refresh request is in-flight.
 */
export async function coordinatedRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = attemptRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

// In-flight GET request coalescing map to eliminate duplicate concurrent requests (e.g. StrictMode mounts)
const inFlightGetRequests = new Map<string, Promise<ApiResult<any>>>();

/**
 * Core fetch wrapper with JWT injection, 401 retry, and in-flight GET coalescing.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const isGet = (!options.method || options.method.toUpperCase() === 'GET') && !options.body;

  if (isGet && inFlightGetRequests.has(path)) {
    return inFlightGetRequests.get(path) as Promise<ApiResult<T>>;
  }

  const execution = (async (): Promise<ApiResult<T>> => {
    // Proactive refresh on cold start / page reload:
    // If accessToken is missing in memory, but a refresh token exists in storage,
    // coordinate a refresh BEFORE firing the request so we never trigger an avoidable 401.
    if (!accessToken && getRefreshToken() && !path.startsWith('/api/v1/auth/')) {
      await coordinatedRefresh();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      let response = await fetch(path, { ...options, headers, credentials: 'include' });

      // On 401, attempt silent refresh and retry once (except on auth endpoints)
      if (response.status === 401 && !path.startsWith('/api/v1/auth/')) {
        const refreshed = await coordinatedRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${accessToken}`;
          response = await fetch(path, { ...options, headers, credentials: 'include' });
        } else {
          // Refresh failed — session expired
          clearTokens();
          onAuthExpired?.();
          return {
            ok: false,
            error: { status: 401, message: 'Session expired. Please log in again.' },
          };
        }
      }

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = undefined;
        }

        const message =
          (errorBody && typeof errorBody === 'object' && 'message' in errorBody
            ? String((errorBody as { message: string }).message)
            : undefined) ?? `Request failed with status ${response.status}`;

        return {
          ok: false,
          error: { status: response.status, message, details: errorBody },
        };
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return { ok: true, data: undefined as unknown as T };
      }

      const data = (await response.json()) as T;
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: {
          status: 0,
          message:
            err instanceof Error ? err.message : 'Network error. Please check your connection.',
        },
      };
    }
  })().finally(() => {
    if (isGet) {
      inFlightGetRequests.delete(path);
    }
  });

  if (isGet) {
    inFlightGetRequests.set(path, execution as Promise<ApiResult<any>>);
  }

  return execution;
}

/** Convenience: GET request */
export function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return apiFetch<T>(path, { method: 'GET' });
}

/** Convenience: POST request */
export function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

/** Convenience: PATCH request */
export function apiPatch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Convenience: DELETE request */
export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
