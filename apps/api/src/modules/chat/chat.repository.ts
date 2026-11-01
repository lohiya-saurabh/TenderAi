/**
 * ChatRepository — Encapsulates domain entity persistence & mutations for conversations and messages.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq, and, asc, desc } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class ChatRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  async findConversationById(
    id: string,
    orgId: string,
  ): Promise<schema.ChatConversation | null> {
    const [row] = await this.db
      .select()
      .from(schema.chatConversations)
      .where(
        and(
          eq(schema.chatConversations.id, id),
          eq(schema.chatConversations.organizationId, orgId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async listConversations(
    orgId: string,
    query?: { bidId?: string; companyId?: string },
  ): Promise<schema.ChatConversation[]> {
    const conditions = [eq(schema.chatConversations.organizationId, orgId)];
    if (query?.bidId) {
      conditions.push(eq(schema.chatConversations.bidId, query.bidId));
    }
    if (query?.companyId) {
      conditions.push(eq(schema.chatConversations.companyId, query.companyId));
    }

    return this.db
      .select()
      .from(schema.chatConversations)
      .where(and(...conditions))
      .orderBy(desc(schema.chatConversations.updatedAt));
  }

  async createConversation(
    data: typeof schema.chatConversations.$inferInsert,
  ): Promise<schema.ChatConversation> {
    const [created] = await this.db
      .insert(schema.chatConversations)
      .values(data)
      .returning();

    if (!created) {
      throw new Error('Failed to create chat conversation.');
    }
    return created;
  }

  async updateConversationTimestamp(
    id: string,
    orgId: string,
    updatedAt: Date = new Date(),
  ): Promise<void> {
    await this.db
      .update(schema.chatConversations)
      .set({ updatedAt })
      .where(
        and(
          eq(schema.chatConversations.id, id),
          eq(schema.chatConversations.organizationId, orgId),
        ),
      );
  }

  async deleteConversation(id: string, orgId: string): Promise<void> {
    await this.db
      .delete(schema.chatConversations)
      .where(
        and(
          eq(schema.chatConversations.id, id),
          eq(schema.chatConversations.organizationId, orgId),
        ),
      );
  }

  async listMessages(conversationId: string, orgId?: string): Promise<schema.ChatMessage[]> {
    const conditions = [eq(schema.chatMessages.conversationId, conversationId)];
    if (orgId) {
      conditions.push(eq(schema.chatMessages.organizationId, orgId));
    }

    return this.db
      .select()
      .from(schema.chatMessages)
      .where(and(...conditions))
      .orderBy(asc(schema.chatMessages.createdAt));
  }

  async getRecentMessageHistory(
    conversationId: string,
    orgId?: string,
    limit: number = 20,
  ): Promise<Array<{ role: string; content: string }>> {
    const conditions = [eq(schema.chatMessages.conversationId, conversationId)];
    if (orgId) {
      conditions.push(eq(schema.chatMessages.organizationId, orgId));
    }

    return this.db
      .select({
        role: schema.chatMessages.role,
        content: schema.chatMessages.content,
      })
      .from(schema.chatMessages)
      .where(and(...conditions))
      .orderBy(asc(schema.chatMessages.createdAt))
      .limit(limit);
  }

  async createMessage(
    data: typeof schema.chatMessages.$inferInsert,
  ): Promise<schema.ChatMessage> {
    const [created] = await this.db
      .insert(schema.chatMessages)
      .values(data)
      .returning();

    if (!created) {
      throw new Error('Failed to create chat message.');
    }
    return created;
  }
}
