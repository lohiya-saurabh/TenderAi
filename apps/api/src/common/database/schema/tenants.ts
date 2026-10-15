import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { pk, orgId, tstz, tstzNow, createdAt, updatedAt } from './helpers.js';

export const tenantSettings = pgTable('tenant_settings', {
  id: pk(),
  organizationId: orgId().unique(),
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
  organizationId: orgId().unique(),
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

export const usageRecords = pgTable('usage_records', {
  id: pk(),
  organizationId: orgId(),
  metric: text('metric').notNull(),
  quantity: integer('quantity').notNull().default(1),
  periodKey: text('period_key').notNull(),
  createdAt: createdAt(),
});

export type UsageRecord = typeof usageRecords.$inferSelect;
