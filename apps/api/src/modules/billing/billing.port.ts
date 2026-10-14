/**
 * BillingPort — Abstract interface for cloud/provider-agnostic payment operations.
 *
 * Domain code depends on this port; provider adapters (e.g. Stripe, Razorpay, Mock) implement it.
 */

export const BILLING_PORT = 'BILLING_PORT';

export interface CreateSubscriptionParams {
  organizationId: string;
  planTier: string;
  billingInterval: 'MONTHLY' | 'ANNUAL';
  customerEmail?: string;
  customerName?: string;
}

export interface BillingPortResult {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
}

export interface BillingPort {
  createSubscription(params: CreateSubscriptionParams): Promise<BillingPortResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  updateSubscriptionPlan(
    subscriptionId: string,
    planTier: string,
    billingInterval: string,
  ): Promise<BillingPortResult>;
}
