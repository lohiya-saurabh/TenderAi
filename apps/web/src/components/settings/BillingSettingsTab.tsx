import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/common/Badge.js';
import { enumLabel } from '@/lib/utils.js';
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
}

export const BillingSettingsTab: React.FC<BillingSettingsTabProps> = ({
  subscription,
  usage,
  plans,
  isChangingPlan,
  billingFeedback,
  onChangePlan,
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
            <CardTitle className="text-base font-semibold">Current plan</CardTitle>
            <CardDescription className="text-xs">Tier, billing period and quotas</CardDescription>
          </div>
          {subscription && (
            <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
              {enumLabel(subscription.status)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {!subscription ? (
            <p className="text-sm text-muted-foreground">No subscription on record.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Fact label="Tier">
                <span className="text-base font-semibold text-foreground">
                  {subscription.planName}
                </span>
                <p className="text-xs text-muted-foreground">
                  {enumLabel(subscription.billingInterval)}
                </p>
              </Fact>
              <Fact label="Price">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {subscription.priceInr !== null
                    ? `₹${subscription.priceInr.toLocaleString('en-IN')} / mo`
                    : 'Not stated'}
                </p>
              </Fact>
              <Fact label="Billing period">
                <p className="text-sm tabular-nums text-foreground">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString()} –{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription.cancelAtPeriodEnd ? 'Ends at period end' : 'Renews at period end'}
                </p>
              </Fact>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Usage this month</h3>
              {usage && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {usage.periodKey}
                </span>
              )}
            </div>
            {!usage ? (
              <p className="text-sm text-muted-foreground">Usage is not available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Meter
                  icon={<Building2 className="h-3.5 w-3.5 text-primary" />}
                  label="Companies"
                  used={usage.activeCompanies}
                  max={usage.maxCompanies}
                />
                <Meter
                  icon={<Users className="h-3.5 w-3.5 text-primary" />}
                  label="Team seats"
                  used={usage.activeUsers}
                  max={usage.maxUsers}
                />
                <Meter
                  icon={<FileText className="h-3.5 w-3.5 text-primary" />}
                  label="Tender analyses"
                  used={usage.monthlyAnalyses}
                  max={usage.maxMonthlyAnalyses}
                />
                <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                    Evidence storage limit
                  </span>
                  <span className="tabular-nums text-foreground">
                    {usage.entitlements['evidence_storage.mb'] != null
                      ? `${usage.entitlements['evidence_storage.mb']} MB`
                      : 'Not stated'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change / Upgrade Plan Selection Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Change or upgrade plan</CardTitle>
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
                        <Badge variant="primary" size="sm">
                          Current
                        </Badge>
                      )}
                    </div>

                    <p className="text-base font-extrabold text-foreground">
                      {p.monthlyPriceInr !== null
                        ? `₹${p.monthlyPriceInr.toLocaleString('en-IN')}`
                        : 'Not stated'}
                      {p.monthlyPriceInr !== null && (
                        <span className="text-2xs text-muted-foreground font-normal">
                          /mo
                        </span>
                      )}
                    </p>

                    <div className="text-2xs text-muted-foreground space-y-1 pt-1">
                      <p>
                        &bull;{' '}
                        {p.entitlements['companies.max'] >= UNLIMITED
                          ? 'Unlimited'
                          : p.entitlements['companies.max']}{' '}
                        companies
                      </p>
                      <p>
                        &bull;{' '}
                        {p.entitlements['users.max'] >= UNLIMITED
                          ? 'Unlimited'
                          : p.entitlements['users.max']}{' '}
                        users
                      </p>
                      <p>
                        &bull;{' '}
                        {p.entitlements['tender_analyses.monthly'] >= UNLIMITED
                          ? 'Unlimited'
                          : p.entitlements['tender_analyses.monthly']}{' '}
                        analyses/mo
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
                      ? 'Current plan'
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

const UNLIMITED = 9999;

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    {children}
  </div>
);

const Meter: React.FC<{ icon: React.ReactNode; label: string; used: number; max: number }> = ({
  icon,
  label,
  used,
  max,
}) => (
  <div className="p-3 rounded-lg border border-border bg-card space-y-2">
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        {icon}
        {label}
      </span>
      <span className="tabular-nums text-muted-foreground">
        <strong className="text-foreground">{used}</strong> /{' '}
        {max >= UNLIMITED ? 'Unlimited' : max}
      </span>
    </div>
    {max < UNLIMITED && <Progress value={Math.min(100, (used / max) * 100)} className="h-1.5" />}
  </div>
);
