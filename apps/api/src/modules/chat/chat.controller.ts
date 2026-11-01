import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  Inject,
} from '@nestjs/common';
import type {
  SendChatMessageRequest,
  SendChatMessageResponse,
  ChatConversationDto,
  ChatMessageDto,
} from '@tenderpulse/shared-types';
import { ChatService } from './chat.service.js';
import { RequirePermission } from '@/common/security/decorators/permissions.decorator.js';
import { Permissions } from '@/common/security/permissions.js';

@Controller('api/v1/chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('messages')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_READ)
  async sendMessage(@Body() body: SendChatMessageRequest): Promise<SendChatMessageResponse> {
    return this.chatService.sendMessage(body);
  }

  @Get('conversations')
  @RequirePermission(Permissions.BIDS_READ)
  async listConversations(
    @Query('bidId') bidId?: string,
    @Query('companyId') companyId?: string,
  ): Promise<ChatConversationDto[]> {
    return this.chatService.listConversations({ bidId, companyId });
  }

  @Get('conversations/:id')
  @RequirePermission(Permissions.BIDS_READ)
  async getConversation(@Param('id') id: string): Promise<ChatConversationDto> {
    return this.chatService.getConversation(id);
  }

  @Get('conversations/:id/messages')
  @RequirePermission(Permissions.BIDS_READ)
  async listMessages(@Param('id') id: string): Promise<ChatMessageDto[]> {
    return this.chatService.listMessages(id);
  }

  @Delete('conversations/:id')
  @HttpCode(200)
  @RequirePermission(Permissions.BIDS_UPDATE)
  async deleteConversation(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.chatService.deleteConversation(id);
  }
}
