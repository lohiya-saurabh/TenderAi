import { describe, it, expect, vi } from 'vitest';
import { ChatController } from '../chat.controller.js';
import type { ChatService } from '../chat.service.js';

describe('ChatController', () => {
  const mockSendMessage = vi.fn();
  const mockListConversations = vi.fn();
  const mockGetConversation = vi.fn();
  const mockListMessages = vi.fn();
  const mockDeleteConversation = vi.fn();

  const mockChatService = {
    sendMessage: mockSendMessage,
    listConversations: mockListConversations,
    getConversation: mockGetConversation,
    listMessages: mockListMessages,
    deleteConversation: mockDeleteConversation,
  } as unknown as ChatService;

  const controller = new ChatController(mockChatService);

  it('delegates sendMessage to ChatService', async () => {
    const payload = { message: 'Hello copilot', bidId: 'bid-1' };
    const expected = {
      conversationId: 'conv-1',
      message: {
        id: 'msg-1',
        conversationId: 'conv-1',
        organizationId: 'org-1',
        role: 'assistant' as const,
        content: 'Hello',
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    };
    mockSendMessage.mockResolvedValue(expected);

    const result = await controller.sendMessage(payload);
    expect(mockSendMessage).toHaveBeenCalledWith(payload);
    expect(result).toEqual(expected);
  });

  it('delegates listConversations to ChatService with filters', async () => {
    mockListConversations.mockResolvedValue([{ id: 'conv-1' }]);

    const result = await controller.listConversations('bid-1', 'comp-1');
    expect(mockListConversations).toHaveBeenCalledWith({
      bidId: 'bid-1',
      companyId: 'comp-1',
    });
    expect(result).toHaveLength(1);
  });

  it('delegates getConversation to ChatService', async () => {
    mockGetConversation.mockResolvedValue({ id: 'conv-1' });

    const result = await controller.getConversation('conv-1');
    expect(mockGetConversation).toHaveBeenCalledWith('conv-1');
    expect(result.id).toBe('conv-1');
  });

  it('delegates listMessages to ChatService', async () => {
    mockListMessages.mockResolvedValue([{ id: 'msg-1' }]);

    const result = await controller.listMessages('conv-1');
    expect(mockListMessages).toHaveBeenCalledWith('conv-1');
    expect(result).toHaveLength(1);
  });

  it('delegates deleteConversation to ChatService', async () => {
    mockDeleteConversation.mockResolvedValue({ success: true });

    const result = await controller.deleteConversation('conv-1');
    expect(mockDeleteConversation).toHaveBeenCalledWith('conv-1');
    expect(result.success).toBe(true);
  });
});
