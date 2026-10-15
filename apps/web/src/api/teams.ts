/**
 * Teams API Client
 */
import { apiGet, apiPost, type ApiResult } from '@/api/client.js';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

export interface InviteMemberDto {
  email: string;
  name: string;
  role: string;
}

export function listTeamMembers(): Promise<ApiResult<TeamMember[]>> {
  return apiGet<TeamMember[]>('/api/v1/teams/members');
}

export function inviteTeamMember(dto: InviteMemberDto): Promise<ApiResult<TeamMember>> {
  return apiPost<TeamMember>('/api/v1/teams/invite', dto);
}
