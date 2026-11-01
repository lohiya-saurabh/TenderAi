import { apiGet, apiPost, apiDelete, type ApiResult } from './client.js';
import type {
  SendChatMessageRequest,
  SendChatMessageResponse,
  ChatConversationDto,
  ChatMessageDto,
} from '@tenderpulse/shared-types';

export async function sendChatMessage(
  request: SendChatMessageRequest,
): Promise<ApiResult<SendChatMessageResponse>> {
  return apiPost<SendChatMessageResponse>('/api/v1/chat/messages', request);
}

export async function listChatConversations(params?: {
  bidId?: string;
  companyId?: string;
}): Promise<ApiResult<ChatConversationDto[]>> {
  const query = new URLSearchParams();
  if (params?.bidId) query.set('bidId', params.bidId);
  if (params?.companyId) query.set('companyId', params.companyId);
  const qs = query.toString();
  return apiGet<ChatConversationDto[]>(`/api/v1/chat/conversations${qs ? `?${qs}` : ''}`);
}

export async function getChatConversation(
  conversationId: string,
): Promise<ApiResult<ChatConversationDto>> {
  return apiGet<ChatConversationDto>(`/api/v1/chat/conversations/${conversationId}`);
}

export async function listChatMessages(
  conversationId: string,
): Promise<ApiResult<ChatMessageDto[]>> {
  return apiGet<ChatMessageDto[]>(`/api/v1/chat/conversations/${conversationId}/messages`);
}

export async function deleteChatConversation(
  conversationId: string,
): Promise<ApiResult<{ success: boolean }>> {
  return apiDelete<{ success: boolean }>(`/api/v1/chat/conversations/${conversationId}`);
}
