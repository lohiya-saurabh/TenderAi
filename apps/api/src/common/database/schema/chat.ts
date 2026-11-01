import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, createdAt, updatedAt } from './helpers.js';
import { organizations } from './tenants.js';
import { users } from './auth.js';
import { companies } from './companies.js';
import { bids } from './bids.js';

export const chatConversations = pgTable('chat_conversations', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  bidId: text('bid_id').references(() => bids.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ChatConversation = typeof chatConversations.$inferSelect;

export const chatMessages = pgTable('chat_messages', {
  id: pk(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => chatConversations.id, { onDelete: 'cascade' }),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  citations: jsonb('citations'),
  financialSummary: jsonb('financial_summary'),
  metadata: jsonb('metadata'),
  createdAt: createdAt(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
