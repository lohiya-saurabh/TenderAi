import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ChatRepository } from './chat.repository.js';
import { ChatQueries } from './chat.queries.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatQueries],
  exports: [ChatService, ChatRepository, ChatQueries],
})
export class ChatModule {}
