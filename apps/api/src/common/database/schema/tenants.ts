import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, tstzNow, createdAt, updatedAt } from './helpers.js';

export const organizations = pgTable('organizations', {
  id: pk(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  domain: text('domain'),
  logoUrl: text('logo_url'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export const tenantSettings = pgTable('tenant_settings', {
  id: pk(),
  organizationId: orgId()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  defaultCompanyId: text('default_company_id'),
  notificationPreferences: jsonb('notification_preferences').notNull().$type<{
    notifyDeadlines: boolean;
    notifyEvidenceExpiry: boolean;
    notifyReviewRequests: boolean;
    notifyHighRiskFlags: boolean;
  }>(),
  updatedAt: updatedAt(),
});

export type TenantSetting = typeof tenantSettings.$inferSelect;
export type NewTenantSetting = typeof tenantSettings.$inferInsert;

export const subscriptions = pgTable('subscriptions', {
  id: pk(),
  organizationId: orgId()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  planTier: text('plan_tier').notNull().default('FREE'),
  billingInterval: text('billing_interval').notNull().default('MONTHLY'),
  status: text('status').notNull().default('ACTIVE'),
  currentPeriodStart: tstzNow('current_period_start'),
  currentPeriodEnd: tstz('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const usageRecords = pgTable('usage_records', {
  id: pk(),
  organizationId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(),
  quantity: integer('quantity').notNull().default(1),
  periodKey: text('period_key').notNull(),
  createdAt: createdAt(),
});

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
