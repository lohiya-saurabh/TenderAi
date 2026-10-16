import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Separator } from '@/components/ui/separator.js';
import { Progress } from '@/components/ui/progress.js';
import {
  Building2,
  Users,
  FileText,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type {
  SubscriptionView,
  UsageSummary,
  PlanDefinition,
  PlanTier,
} from '@/api/billing.js';

interface BillingSettingsTabProps {
  subscription: SubscriptionView | null;
  usage: UsageSummary | null;
  plans: PlanDefinition[];
  isChangingPlan: boolean;
  billingFeedback: {
    type: 'success' | 'error';
    message: string;
  } | null;
  onChangePlan: (tier: PlanTier) => void;
  companiesCount: number;
}

export const BillingSettingsTab: React.FC<BillingSettingsTabProps> = ({
  subscription,
  usage,
  plans,
  isChangingPlan,
  billingFeedback,
  onChangePlan,
  companiesCount,
}) => {
  return (
    <div className="space-y-6">
      {billingFeedback && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
            billingFeedback.type === 'success'
              ? 'bg-primary/10 border border-primary/30 text-primary'
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          }`}
        >
          {billingFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{billingFeedback.message}</span>
        </div>
      )}

      {/* Active Subscription Overview Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Active Subscription Plan</CardTitle>
            <CardDescription className="text-xs">
              Current tier, billing interval, and entitlement boundaries
            </CardDescription>
          </div>
          <Badge
            variant={subscription?.status === 'ACTIVE' ? 'default' : 'secondary'}
            className="text-xs uppercase font-mono"
          >
            {subscription?.status || 'ACTIVE'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Current Tier
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">
                  {subscription?.planName || 'Growth Plan'}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {subscription?.planTier || 'GROWTH'}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {subscription?.billingInterval === 'ANNUAL'
                  ? 'Billed Annually'
                  : 'Billed Monthly'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Price / Interval
              </span>
              <p className="text-base font-bold text-foreground">
                {subscription?.priceInr !== null && subscription?.priceInr !== undefined
                  ? `₹${subscription.priceInr.toLocaleString('en-IN')} / mo`
                  : 'Custom Enterprise'}
              </p>
              <p className="text-[10px] text-muted-foreground">Provider-Agnostic Invoicing</p>
            </div>

            <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Billing Period
              </span>
              <p className="text-xs font-mono font-medium text-foreground">
                {subscription?.currentPeriodStart
                  ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                  : 'Active'}{' '}
                –{' '}
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'Renewal Active'}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">
                Auto-renewal enabled
              </p>
            </div>
          </div>

          <Separator />

          {/* Usage & Quota Meters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Current Monthly Usage &amp; Quotas
              </h4>
              <span className="text-[10px] text-muted-foreground font-mono">
                Billing Cycle: {usage?.periodKey || new Date().toISOString().slice(0, 7)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Companies Meter */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>Registered Legal Entities</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {usage?.activeCompanies ?? companiesCount}
                    </strong>{' '}
                    /{' '}
                    {(usage?.maxCompanies ?? 5) >= 9999
                      ? 'Unlimited'
                      : (usage?.maxCompanies ?? 5)}
                  </span>
                </div>
                <Progress
                  value={
                    (usage?.maxCompanies ?? 5) >= 9999
                      ? 10
                      : Math.min(
                          100,
                          ((usage?.activeCompanies ?? companiesCount) /
                            (usage?.maxCompanies ?? 5)) *
                            100,
                        )
                  }
                  className="h-1.5"
                />
              </div>

              {/* Team Users Meter */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Team User Seats</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <strong className="text-foreground">{usage?.activeUsers ?? 1}</strong> /{' '}
                    {(usage?.maxUsers ?? 10) >= 9999 ? 'Unlimited' : (usage?.maxUsers ?? 10)}
                  </span>
                </div>
                <Progress
                  value={
                    (usage?.maxUsers ?? 10) >= 9999
                      ? 10
                      : Math.min(
                          100,
                          ((usage?.activeUsers ?? 1) / (usage?.maxUsers ?? 10)) * 100,
                        )
                  }
                  className="h-1.5"
                />
              </div>

              {/* Monthly Tender Analyses Meter */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>Tender Ingestions this Month</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <strong className="text-foreground">{usage?.monthlyAnalyses ?? 0}</strong> /{' '}
                    {(usage?.maxMonthlyAnalyses ?? 50) >= 9999
                      ? 'Unlimited'
                      : (usage?.maxMonthlyAnalyses ?? 50)}
                  </span>
                </div>
                <Progress
                  value={
                    (usage?.maxMonthlyAnalyses ?? 50) >= 9999
                      ? 5
                      : Math.min(
                          100,
                          ((usage?.monthlyAnalyses ?? 0) / (usage?.maxMonthlyAnalyses ?? 50)) *
                            100,
                        )
                  }
                  className="h-1.5"
                />
              </div>

              {/* Evidence Storage Meter */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                    <span>Evidence Storage Limit</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {usage?.entitlements['evidence_storage.mb'] ?? 500} MB
                    </strong>
                  </span>
                </div>
                <Progress value={25} className="h-1.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change / Upgrade Plan Selection Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Change or Upgrade Plan</CardTitle>
          <CardDescription className="text-xs">
            Instantly adjust tenant quotas and unlock advanced features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {plans.map((p) => {
              const isCurrent = subscription?.planTier === p.tier;
              return (
                <div
                  key={p.tier}
                  className={`p-3.5 rounded-lg border flex flex-col justify-between space-y-3 transition-all ${
                    isCurrent
                      ? 'bg-primary/10 border-primary ring-1 ring-primary'
                      : 'bg-card border-border hover:border-border/80'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{p.name}</span>
                      {isCurrent && (
                        <Badge variant="default" className="text-[9px]">
                          Current
                        </Badge>
                      )}
                    </div>

                    <p className="text-base font-extrabold text-foreground">
                      {p.monthlyPriceInr !== null
                        ? `₹${p.monthlyPriceInr.toLocaleString('en-IN')}`
                        : 'Custom'}
                      {p.monthlyPriceInr !== null && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          /mo
                        </span>
                      )}
                    </p>

                    <div className="text-[10px] text-muted-foreground space-y-1 pt-1">
                      <p>
                        &bull;{' '}
                        {p.entitlements['companies.max'] >= 9999
                          ? 'Unlimited'
                          : p.entitlements['companies.max']}{' '}
                        Companies
                      </p>
                      <p>
                        &bull;{' '}
                        {p.entitlements['users.max'] >= 9999
                          ? 'Unlimited'
                          : p.entitlements['users.max']}{' '}
                        Users
                      </p>
                      <p>
                        &bull;{' '}
                        {p.entitlements['tender_analyses.monthly'] >= 9999
                          ? 'Unlimited'
                          : p.entitlements['tender_analyses.monthly']}{' '}
                        Analyses/mo
                      </p>
                    </div>
                  </div>

                  <Button
                    variant={isCurrent ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={isCurrent || isChangingPlan}
                    onClick={() => onChangePlan(p.tier)}
                    className="w-full text-xs h-8"
                  >
                    {isCurrent
                      ? 'Active Plan'
                      : `Switch to ${p.name.replace(' Plan', '').replace(' Tier', '')}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
