import { text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Reusable column definition helpers to DRY up repetitive table definitions.
 */
export const pk = (name = 'id') => text(name).primaryKey();
export const orgId = (name = 'organization_id') => text(name).notNull();
export const tstz = (name: string) => timestamp(name, { withTimezone: true });
export const tstzNow = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const createdAt = (name = 'created_at') => tstzNow(name);
export const updatedAt = (name = 'updated_at') => tstzNow(name);
