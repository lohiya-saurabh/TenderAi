/**
 * TenderPulse AI — Auth API
 *
 * Login, refresh, and logout API calls.
 */

import { apiPost, clearTokens, type ApiResult } from './client.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse extends LoginResponse {
  company?: {
    id: string;
    legalName: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  udyamId?: string;
  locationState?: string;
  planTier?: string;
}

/**
 * Authenticate with email + password.
 * Returns JWT tokens and user profile with permissions.
 */
export function login(
  email: string,
  password: string,
): Promise<ApiResult<LoginResponse>> {
  return apiPost<LoginResponse>('/api/v1/auth/login', { email, password });
}

/**
 * Register a new user account, tenant workspace, and initial company.
 */
export function register(
  data: RegisterRequest,
): Promise<ApiResult<RegisterResponse>> {
  return apiPost<RegisterResponse>('/api/v1/auth/register', data);
}

/**
 * Refresh the access token using the refresh token.
 */
export function refreshTokens(
  refreshToken: string,
): Promise<ApiResult<RefreshResponse>> {
  return apiPost<RefreshResponse>('/api/v1/auth/refresh', { refreshToken });
}

/**
 * Log out (revokes refresh token session on the backend and clears client-side tokens).
 */
export async function logout(): Promise<void> {
  try {
    await apiPost('/api/v1/auth/logout', {});
  } catch {
    // Ignore network failures on logout to guarantee client-side cleanup
  } finally {
    clearTokens();
  }
}
