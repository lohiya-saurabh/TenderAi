/**
 * Billing & Subscription Domain Types & Plan Catalog
 *
 * Provider-agnostic domain models for tenant subscriptions, entitlements, and usage.
 */

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
  monthlyPriceInr: number | null; // null for custom Enterprise
  annualMonthlyPriceInr: number | null;
  features: string[];
  entitlements: PlanEntitlements;
  highlighted?: boolean;
}

export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: 'FREE',
    name: 'Free Evaluation',
    description: 'For contractors exploring tender intelligence and bid readiness.',
    monthlyPriceInr: 0,
    annualMonthlyPriceInr: 0,
    features: [
      '1 Company capability profile',
      '1 User workspace account',
      '3 Tender analyses per month',
      '100 MB Evidence storage',
      'Basic Bid/No-Bid recommendations',
      'Standard compliance matrix',
    ],
    entitlements: {
      'companies.max': 1,
      'users.max': 1,
      'tender_analyses.monthly': 3,
      'evidence_storage.mb': 100,
      'risk_analysis.advanced': false,
      'human_review.workflow': false,
    },
  },
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    description: 'For small vendors beginning structured public procurement operations.',
    monthlyPriceInr: 999,
    annualMonthlyPriceInr: 799,
    features: [
      '1 Company capability profile',
      'Up to 3 Team members',
      '15 Tender analyses per month',
      '1 GB Evidence storage',
      'Tender risk analysis & radar',
      'Dual-sided evidence grounding',
      'Email & in-app notifications',
    ],
    entitlements: {
      'companies.max': 1,
      'users.max': 3,
      'tender_analyses.monthly': 15,
      'evidence_storage.mb': 1024,
      'risk_analysis.advanced': true,
      'human_review.workflow': false,
    },
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth',
    description: 'For active MSME bid teams managing multiple sister entities.',
    monthlyPriceInr: 2499,
    annualMonthlyPriceInr: 1999,
    highlighted: true,
    features: [
      'Up to 5 Companies / JVs',
      'Up to 10 Team members',
      '50 Tender analyses per month',
      '5 GB Evidence storage',
      'Human review adjudication console',
      'Full statutory compliance workflow',
      'Priority OCR & document extraction',
      'CA UDIN & SFMS verification alerts',
    ],
    entitlements: {
      'companies.max': 5,
      'users.max': 10,
      'tender_analyses.monthly': 50,
      'evidence_storage.mb': 5120,
      'risk_analysis.advanced': true,
      'human_review.workflow': true,
    },
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    description: 'For large contractors with high-volume bidding operations.',
    monthlyPriceInr: 6999,
    annualMonthlyPriceInr: 5599,
    features: [
      'Up to 15 Companies / Consortia',
      'Up to 25 Team members',
      '150 Tender analyses per month',
      '20 GB Evidence storage',
      'Advanced audit trail & exports',
      'Custom clause taxonomy models',
      'Dedicated compliance specialist review',
    ],
    entitlements: {
      'companies.max': 15,
      'users.max': 25,
      'tender_analyses.monthly': 150,
      'evidence_storage.mb': 20480,
      'risk_analysis.advanced': true,
      'human_review.workflow': true,
    },
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For infrastructure enterprises requiring custom security and volume.',
    monthlyPriceInr: null,
    annualMonthlyPriceInr: null,
    features: [
      'Unlimited Companies & JVs',
      'Unlimited Team seats & SSO (SAML/OIDC)',
      'Custom monthly analysis volume',
      '100+ GB Dedicated evidence storage',
      'Custom ERP & procurement integrations',
      'Dedicated SLA & account management',
      'Custom data residency & VPC deployment',
    ],
    entitlements: {
      'companies.max': 9999,
      'users.max': 9999,
      'tender_analyses.monthly': 9999,
      'evidence_storage.mb': 102400,
      'risk_analysis.advanced': true,
      'human_review.workflow': true,
    },
  },
};

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

export interface ChangePlanDto {
  planTier: PlanTier;
  billingInterval?: BillingInterval;
}
