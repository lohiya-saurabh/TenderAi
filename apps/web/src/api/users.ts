/**
 * Users API Client
 */
import { apiGet, apiPatch, apiPost, type ApiResult } from './client.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

export interface UpdateUserProfileDto {
  name?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  currentPassword?: string;
  newPassword?: string;
}

export function getMe(): Promise<ApiResult<UserProfile>> {
  return apiGet<UserProfile>('/api/v1/users/me');
}

export function updateMe(dto: UpdateUserProfileDto): Promise<ApiResult<UserProfile>> {
  return apiPatch<UserProfile>('/api/v1/users/me', dto);
}

export function changePassword(dto: ChangePasswordDto): Promise<ApiResult<{ success: boolean; message: string }>> {
  return apiPost<{ success: boolean; message: string }>('/api/v1/users/change-password', dto);
}
