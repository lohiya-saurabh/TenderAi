/**
 * TenderPulse AI — Billing & Subscription Web API Client
 */
import { apiGet, apiPost, type ApiResult } from '@/api/client.js';

export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface PlanEntitlements {
  'companies.max': number;
  'users.max': number;
  'tender_analyses.monthly': number;
  'evidence_storage.mb': number;
  'risk_analysis.advanced': boolean;
  'human_review.workflow': boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPriceInr: number | null;
  annualMonthlyPriceInr: number | null;
  features: string[];
  entitlements: PlanEntitlements;
  highlighted?: boolean;
}

export interface SubscriptionView {
  id: string;
  organizationId: string;
  planTier: PlanTier;
  planName: string;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  entitlements: PlanEntitlements;
  priceInr: number | null;
}

export interface UsageSummary {
  activeCompanies: number;
  maxCompanies: number;
  activeUsers: number;
  maxUsers: number;
  monthlyAnalyses: number;
  maxMonthlyAnalyses: number;
  periodKey: string;
  entitlements: PlanEntitlements;
}

export interface ChangePlanRequest {
  planTier: PlanTier;
  billingInterval?: BillingInterval;
}

/**
 * Get all available public pricing plans.
 */
export function getPlans(): Promise<ApiResult<PlanDefinition[]>> {
  return apiGet<PlanDefinition[]>('/api/v1/billing/plans');
}

/**
 * Get current tenant subscription details.
 */
export function getSubscription(): Promise<ApiResult<SubscriptionView>> {
  return apiGet<SubscriptionView>('/api/v1/billing/subscription');
}

/**
 * Get current tenant usage summary and entitlement limits.
 */
export function getUsageSummary(): Promise<ApiResult<UsageSummary>> {
  return apiGet<UsageSummary>('/api/v1/billing/usage');
}

/**
 * Change / upgrade the tenant subscription plan.
 */
export function changePlan(data: ChangePlanRequest): Promise<ApiResult<SubscriptionView>> {
  return apiPost<SubscriptionView>('/api/v1/billing/change-plan', data);
}
