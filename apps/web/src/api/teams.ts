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
  /** True until the member opens their invite link and sets a password. */
  invitePending?: boolean;
}

/** Returned once when an invite is created or reissued; only its hash is stored. */
export interface InviteLink extends TeamMember {
  inviteUrl: string;
  inviteExpiresAt: string;
}

export interface InviteMemberDto {
  email: string;
  name: string;
  role: string;
}

export function listTeamMembers(): Promise<ApiResult<TeamMember[]>> {
  return apiGet<TeamMember[]>('/api/v1/teams/members');
}

export function inviteTeamMember(dto: InviteMemberDto): Promise<ApiResult<InviteLink>> {
  return apiPost<InviteLink>('/api/v1/teams/invite', dto);
}

export function reissueInviteLink(memberId: string): Promise<ApiResult<InviteLink>> {
  return apiPost<InviteLink>(`/api/v1/teams/members/${encodeURIComponent(memberId)}/invite-link`);
}
