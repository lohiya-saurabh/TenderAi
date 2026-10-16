import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPlans, type PlanDefinition, type BillingInterval } from '@/api/billing.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Check, ArrowRight, Building2, Users, FileText, HardDrive, Sparkles } from 'lucide-react';

const CANONICAL_PLANS: PlanDefinition[] = [
  {
    tier: 'FREE',
    name: 'Free Evaluation',
    description: 'For contractors exploring tender intelligence and bid readiness.',
    monthlyPriceInr: 0,
    annualMonthlyPriceInr: 0,
    features: [
      'Basic Bid / No-Bid scoring engine',
      'Clause-by-clause compliance matrix',
      'Standard NIT document extraction',
      'Community email support',
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
  {
    tier: 'STARTER',
    name: 'Starter Plan',
    description: 'For small vendors beginning structured public procurement operations.',
    monthlyPriceInr: 999,
    annualMonthlyPriceInr: 799,
    features: [
      'Tender risk analysis & radar',
      'Dual-sided evidence grounding citations',
      'Automated deadline & expiry notifications',
      'Exportable compliance audit summaries',
      'Standard email & ticketing support',
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
  {
    tier: 'GROWTH',
    name: 'Growth Plan',
    description: 'For active MSME bid teams managing multiple sister entities.',
    monthlyPriceInr: 2499,
    annualMonthlyPriceInr: 1999,
    highlighted: true,
    features: [
      'Human review adjudication console',
      'Full statutory compliance sign-off workflow',
      'Priority OCR & fast document extraction',
      'CA UDIN & SFMS certificate alerts',
      'Custom eligibility matching criteria',
      'Priority 24-hour turnaround support',
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
  {
    tier: 'BUSINESS',
    name: 'Business Plan',
    description: 'For multi-entity EPC contractors & consortium bidding leaders.',
    monthlyPriceInr: 6999,
    annualMonthlyPriceInr: 5599,
    features: [
      'Multi-entity & JV consortium switching',
      'Full collaborative review sign-off queue',
      'Cryptographic audit trail & PDF exports',
      'Custom clause taxonomy models',
      'Dedicated compliance specialist review',
      'Dedicated Account Manager with SLA',
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
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise Plan',
    description: 'For infrastructure enterprises requiring custom volume and security.',
    monthlyPriceInr: null,
    annualMonthlyPriceInr: null,
    features: [
      'Custom monthly analysis volume',
      'SSO Authentication (SAML / OIDC)',
      'Custom ERP & procurement integrations',
      'Private VPC & Self-Hosted deployment',
      'Custom SLA & 24/7 dedicated telephone support',
      'Custom master services agreement & invoicing',
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
];

export interface PlanCardsProps {
  initialInterval?: BillingInterval;
  displayMode?: 'all' | 'flagship';
  showToggle?: boolean;
}

export const PlanCards: React.FC<PlanCardsProps> = ({
  initialInterval = 'MONTHLY',
  displayMode = 'all',
  showToggle = true,
}) => {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(initialInterval);
  const [plans, setPlans] = useState<PlanDefinition[]>(CANONICAL_PLANS);

  useEffect(() => {
    const fetchCatalog = async () => {
      const res = await getPlans();
      if (res.ok && res.data && res.data.length > 0) {
        setPlans(res.data);
      }
    };
    fetchCatalog();
  }, []);

  const displayedPlans =
    displayMode === 'flagship'
      ? plans.filter((p) => p.tier === 'STARTER' || p.tier === 'GROWTH' || p.tier === 'BUSINESS')
      : plans;

  const isAnnual = billingInterval === 'ANNUAL';

  return (
    <div className="space-y-8">
      {/* Billing Interval Toggle */}
      {showToggle && (
        <div className="flex items-center justify-center gap-3">
          <div className="bg-card border border-border p-1 rounded-lg inline-flex items-center gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingInterval('MONTHLY')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                billingInterval === 'MONTHLY'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('ANNUAL')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                billingInterval === 'ANNUAL'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono border border-orange-500/25">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div
        className={`grid gap-6 ${
          displayMode === 'flagship'
            ? 'grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        }`}
      >
        {displayedPlans.map((plan) => {
          const price = isAnnual
            ? (plan.annualMonthlyPriceInr ?? plan.monthlyPriceInr)
            : plan.monthlyPriceInr;

          const isHighlighted = plan.highlighted || plan.tier === 'GROWTH';
          const isBusiness = plan.tier === 'BUSINESS';

          return (
            <Card
              key={plan.tier}
              className={`flex flex-col justify-between relative transition-all duration-200 ${
                isHighlighted
                  ? 'border-primary shadow-xl bg-card ring-1 ring-primary'
                  : 'border-border bg-card hover:border-foreground/30 shadow-xs'
              }`}
            >
              {isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    <span>Most Popular</span>
                  </span>
                </div>
              )}

              {isBusiness && !isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted border border-border text-foreground text-[10px] font-semibold uppercase tracking-wider">
                    High Volume
                  </span>
                </div>
              )}

              <CardHeader className="space-y-2 pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={isHighlighted ? 'default' : 'outline'}
                    className="text-[10px] font-mono"
                  >
                    {plan.tier}
                  </Badge>
                </div>

                <CardTitle className="text-lg font-bold text-foreground">{plan.name}</CardTitle>

                <CardDescription className="text-xs text-muted-foreground min-h-[48px] line-clamp-3 leading-relaxed">
                  {plan.description}
                </CardDescription>

                {/* Price Display */}
                <div className="pt-2">
                  {price !== null ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">/ month</span>
                      </div>
                      {isAnnual && price > 0 ? (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Billed annually (₹{(price * 12).toLocaleString('en-IN')} / yr)
                        </p>
                      ) : price === 0 ? (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Free forever &bull; No card required
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Billed monthly
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                        Custom
                      </span>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        Tailored enterprise contract
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0 flex-1 flex flex-col justify-between">
                {/* Entitlement Metrics */}
                <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Companies</span>
                    </span>
                    <span className="font-semibold text-foreground font-mono text-[11px]">
                      {plan.entitlements['companies.max'] >= 9999
                        ? 'Unlimited'
                        : `${plan.entitlements['companies.max']} ${
                            plan.entitlements['companies.max'] === 1 ? 'Entity' : 'Entities'
                          }`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Team Seats</span>
                    </span>
                    <span className="font-semibold text-foreground font-mono text-[11px]">
                      {plan.entitlements['users.max'] >= 9999
                        ? 'Unlimited'
                        : `${plan.entitlements['users.max']} Users`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Analyses / mo</span>
                    </span>
                    <span className="font-semibold text-foreground font-mono text-[11px]">
                      {plan.entitlements['tender_analyses.monthly'] >= 9999
                        ? 'Unlimited'
                        : `${plan.entitlements['tender_analyses.monthly']} / mo`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Evidence Vault</span>
                    </span>
                    <span className="font-semibold text-foreground font-mono text-[11px]">
                      {plan.entitlements['evidence_storage.mb'] >= 1024
                        ? `${(plan.entitlements['evidence_storage.mb'] / 1024).toFixed(0)} GB`
                        : `${plan.entitlements['evidence_storage.mb']} MB`}
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-3 border-t border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Key Capabilities
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  {plan.tier === 'ENTERPRISE' ? (
                    <Link to="/signup?plan=ENTERPRISE">
                      <Button variant="outline" className="w-full text-xs font-semibold">
                        Contact Enterprise Sales
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/signup?plan=${plan.tier}&interval=${billingInterval}`}>
                      <Button
                        variant={isHighlighted ? 'default' : 'outline'}
                        className="w-full text-xs font-semibold gap-1.5"
                      >
                        <span>
                          {isHighlighted
                            ? 'Start Growth Trial'
                            : isBusiness
                              ? 'Select Business'
                              : `Select ${plan.name.replace(' Plan', '').replace(' Evaluation', '')}`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
