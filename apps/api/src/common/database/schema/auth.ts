import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, createdAt } from './helpers.js';
import { organizations } from './tenants.js';

export const users = pgTable('users', {
  id: pk(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  organizationName: text('organization_name').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const refreshTokens = pgTable('refresh_tokens', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  revokedAt: tstz('revoked_at'),
  expiresAt: tstz('expires_at').notNull(),
  createdAt: createdAt(),
});

export type RefreshTokenRecord = typeof refreshTokens.$inferSelect;
