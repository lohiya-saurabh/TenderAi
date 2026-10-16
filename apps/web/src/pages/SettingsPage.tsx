import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { useCompany } from '@/context/useCompany.js';
import { useTheme } from '@/context/useTheme.js';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  type NotificationPreferences,
  type WorkspaceSettings,
} from '@/api/settings.js';
import { listTeamMembers, inviteTeamMember, type TeamMember } from '@/api/teams.js';
import {
  getSubscription,
  getUsageSummary,
  changePlan,
  getPlans,
  type SubscriptionView,
  type UsageSummary,
  type PlanDefinition,
  type PlanTier,
} from '@/api/billing.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import { Separator } from '@/components/ui/separator.js';
import { Progress } from '@/components/ui/progress.js';
import {
  Building2,
  Bell,
  Shield,
  Users,
  Settings,
  Check,
  Plus,
  ExternalLink,
  ShieldCheck,
  Lock,
  UserPlus,
  CheckCircle2,
  Mail,
  User,
  CreditCard,
  HardDrive,
  FileText,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { companies, selectedCompanyId, setSelectedCompanyId, createCompany } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'general';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Workspace settings state
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    notifyDeadlines: true,
    notifyEvidenceExpiry: true,
    notifyReviewRequests: true,
    notifyHighRiskFlags: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Team members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('BID_MANAGER');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // New Company form in Company tab
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  // Billing & Subscription state
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load workspace settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const res = await getWorkspaceSettings();
      if (res.ok) {
        setWorkspaceSettings(res.data);
        if (res.data.notificationPreferences) {
          setNotifications(res.data.notificationPreferences);
        }
      }
    };
    fetchSettings();
  }, []);

  // Load team members when team tab is active
  useEffect(() => {
    if (activeTab === 'team') {
      const fetchTeam = async () => {
        setIsTeamLoading(true);
        const res = await listTeamMembers();
        if (res.ok) {
          setTeamMembers(res.data);
        }
        setIsTeamLoading(false);
      };
      fetchTeam();
    }
  }, [activeTab]);

  // Load billing & usage when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing') {
      const fetchBillingData = async () => {
        const [subRes, usageRes, plansRes] = await Promise.all([
          getSubscription(),
          getUsageSummary(),
          getPlans(),
        ]);
        if (subRes.ok) setSubscription(subRes.data);
        if (usageRes.ok) setUsage(usageRes.data);
        if (plansRes.ok && plansRes.data) setPlans(plansRes.data);
      };
      fetchBillingData();
    }
  }, [activeTab]);

  const handleToggleNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setIsSavingSettings(true);

    const res = await updateWorkspaceSettings({
      notificationPreferences: updated,
    });

    setIsSavingSettings(false);
    if (res.ok) {
      setWorkspaceSettings(res.data);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 2500);
    }
  };

  const handleSelectDefaultCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    const res = await updateWorkspaceSettings({
      defaultCompanyId: companyId,
    });
    if (res.ok) {
      setWorkspaceSettings(res.data);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 2500);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError('Name and valid email are required.');
      return;
    }

    setIsSubmittingInvite(true);
    setInviteError(null);

    const res = await inviteTeamMember({
      email: inviteEmail.trim(),
      name: inviteName.trim(),
      role: inviteRole,
    });

    setIsSubmittingInvite(false);

    if (res.ok) {
      setTeamMembers((prev) => [...prev, res.data]);
      setInviteSuccess(true);
      setInviteEmail('');
      setInviteName('');
      setIsInvitingMember(false);
      setTimeout(() => setInviteSuccess(false), 3500);
    } else {
      setInviteError(res.error.message || 'Failed to provision team member.');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsSubmittingCompany(true);
    try {
      const created = await createCompany({
        legalName: newCompanyName.trim(),
        gstin: newGstin.trim() || undefined,
      });
      if (created) {
        setNewCompanyName('');
        setNewGstin('');
        setIsAddingCompany(false);
      }
    } finally {
      setIsSubmittingCompany(false);
    }
  };

  const handleChangePlan = async (tier: PlanTier) => {
    setIsChangingPlan(true);
    setBillingFeedback(null);

    const res = await changePlan({ planTier: tier });
    setIsChangingPlan(false);

    if (res.ok) {
      setSubscription(res.data);
      const usageRes = await getUsageSummary();
      if (usageRes.ok) setUsage(usageRes.data);

      setBillingFeedback({
        type: 'success',
        message: `Plan successfully changed to ${res.data.planName}. New entitlements are active.`,
      });
      setTimeout(() => setBillingFeedback(null), 4000);
    } else {
      setBillingFeedback({
        type: 'error',
        message: res.error.message || 'Failed to update subscription plan.',
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Workspace &amp; System Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure tenant workspace parameters, billing subscriptions, team members, and alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Tenant: {user?.organizationId || '—'}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-border hover:bg-accent cursor-pointer transition-colors shadow-2xs"
            aria-label={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Current theme: ${theme === 'dark' ? 'Dark' : 'Light'}. Click to switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Moon className="h-3.5 w-3.5 text-orange-400" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline text-xs font-mono font-medium text-foreground">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </Button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {settingsSuccess && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Workspace preferences saved and synchronized to PostgreSQL.</span>
        </div>
      )}

      {/* 2. Settings Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full bg-muted/60 p-1 rounded-lg border border-border">
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Billing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>Team &amp; RBAC</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            <span>Companies</span>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: GENERAL WORKSPACE SETTINGS */}
        {/* ================================================================= */}
        <TabsContent value="general" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Tenant Workspace Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Core workspace properties and tenant-level regional defaults
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="workspaceName">Workspace Name</Label>
                  <Input
                    id="workspaceName"
                    value={
                      workspaceSettings?.organizationName || user?.organizationName || 'Workspace'
                    }
                    disabled
                    className="bg-muted/30 font-medium text-foreground cursor-not-allowed border-border"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    SaaS organization tenant boundary identifier
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenantId">Tenant Organization ID</Label>
                  <Input
                    id="tenantId"
                    value={workspaceSettings?.organizationId || user?.organizationId || '—'}
                    disabled
                    className="bg-muted/30 font-mono text-xs text-foreground cursor-not-allowed border-border"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Cryptographically bound to your JWT session token claims
                  </span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs font-semibold">Default Active Company Entity</Label>
                <p className="text-xs text-muted-foreground">
                  Select which registered company is automatically selected when you launch new
                  tenders or review dossiers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {companies.map((company) => {
                    const isSelected = company.id === selectedCompanyId;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => handleSelectDefaultCompany(company.id)}
                        className={`p-3 rounded-lg border text-left transition-all flex items-start justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                            : 'bg-card hover:bg-accent/60 border-border text-muted-foreground'
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{company.legalName}</span>
                          </div>
                          {company.gstin && (
                            <p className="text-[10px] font-mono text-muted-foreground">
                              GSTIN: {company.gstin}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground shrink-0 mt-0.5">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Procurement Standard &amp; Region
                  </span>
                  <p className="font-medium text-foreground">
                    India Public Procurement (GeM / CPPP)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    INR Currency (₹ Lakhs / Crores)
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Data Residency &amp; Compliance
                  </span>
                  <p className="font-medium text-foreground">AWS ap-south-1 (Mumbai)</p>
                  <p className="text-[10px] text-muted-foreground">
                    DPDP Act 2023 Compliant Storage
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance & Color Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Appearance &amp; Visual Theme
              </CardTitle>
              <CardDescription className="text-xs">
                Select your preferred interface display mode. Saved persistently to tenant
                preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dark Theme Option Card */}
                <button
                  type="button"
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                      : 'bg-card hover:bg-accent/60 border-border text-muted-foreground'
                  }`}
                >
                  <div className="space-y-1.5 pr-2">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Moon className="h-4 w-4 text-orange-400" />
                      <span>Executive Dark (Default)</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Deep zinc canvas with crisp high-contrast cards and surgical terracotta orange
                      accents.
                    </p>
                  </div>
                  {theme === 'dark' && (
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground shrink-0 mt-0.5">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>

                {/* Light Theme Option Card */}
                <button
                  type="button"
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                    theme === 'light'
                      ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                      : 'bg-card hover:bg-accent/60 border-border text-muted-foreground'
                  }`}
                >
                  <div className="space-y-1.5 pr-2">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span>Crisp Daylight Light</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pure white canvas with ink-black typography and hairline zinc dividers for
                      daytime audits.
                    </p>
                  </div>
                  {theme === 'light' && (
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground shrink-0 mt-0.5">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: BILLING, SUBSCRIPTIONS & ENTITLEMENT USAGE */}
        {/* ================================================================= */}
        <TabsContent value="billing" className="space-y-6 mt-0">
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
                          {usage?.activeCompanies ?? companies.length}
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
                              ((usage?.activeCompanies ?? companies.length) /
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
                        onClick={() => handleChangePlan(p.tier)}
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
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: NOTIFICATION PREFERENCES */}
        {/* ================================================================= */}
        <TabsContent value="notifications" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Tender Alert Preferences</CardTitle>
              <CardDescription className="text-xs">
                Control in-app status banners and critical procurement timeline alerts (Persisted to
                Database)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyDeadlines" className="text-xs font-semibold">
                      Tender Submission Deadline Warnings
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display amber/red alerts when submission deadline is within 7 days or 48 hours
                    </p>
                  </div>
                  <Switch
                    id="notifyDeadlines"
                    checked={notifications.notifyDeadlines}
                    onCheckedChange={(val) => handleToggleNotification('notifyDeadlines', val)}
                    disabled={isSavingSettings}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyEvidenceExpiry" className="text-xs font-semibold">
                      Company Evidence Expiration Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Notify when CA UDIN certificates, solvency letters, or ISO audits are expiring
                      within 90 days
                    </p>
                  </div>
                  <Switch
                    id="notifyEvidenceExpiry"
                    checked={notifications.notifyEvidenceExpiry}
                    onCheckedChange={(val) => handleToggleNotification('notifyEvidenceExpiry', val)}
                    disabled={isSavingSettings}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyReviewRequests" className="text-xs font-semibold">
                      Human Review Task Requests
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Flag tender clauses requiring manual sign-off by Legal Counsel or Financial
                      Controller
                    </p>
                  </div>
                  <Switch
                    id="notifyReviewRequests"
                    checked={notifications.notifyReviewRequests}
                    onCheckedChange={(val) => handleToggleNotification('notifyReviewRequests', val)}
                    disabled={isSavingSettings}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyHighRiskFlags" className="text-xs font-semibold">
                      Critical Disqualification Risk Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Highlight Liquidated Damages caps exceeding 10% or non-refundable EMD
                      forfeiture clauses
                    </p>
                  </div>
                  <Switch
                    id="notifyHighRiskFlags"
                    checked={notifications.notifyHighRiskFlags}
                    onCheckedChange={(val) => handleToggleNotification('notifyHighRiskFlags', val)}
                    disabled={isSavingSettings}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: SECURITY & SESSION POLICIES */}
        {/* ================================================================= */}
        <TabsContent value="security" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Session Security &amp; Token Architecture
              </CardTitle>
              <CardDescription className="text-xs">
                Active cryptographic session properties and isolation enforcement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-foreground" />
                    <span>Cryptographic Token Session</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Access is signed using RFC 7519 HMAC-SHA256 tokens with timing-safe signature
                    verification.
                  </p>
                  <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-muted-foreground">
                    <span>Algorithm: HS256</span>
                    <span>•</span>
                    <span>Status: Active</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>Fiber-Safe Tenant Isolation</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Every API request executes in an isolated Node.js AsyncLocalStorage fiber with
                    anti-IDOR filters.
                  </p>
                  <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-muted-foreground">
                    <span>Context: TenantContextHolder</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Upcoming Security Roadmap
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Two-Factor Authentication (2FA)
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Roadmap
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Time-based One-Time Password (TOTP) enforcement for administrative role
                      changes.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Audit Log Export (SIEM)</span>
                      <Badge variant="outline" className="text-[10px]">
                        Roadmap
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Stream cryptographic audit event logs directly to external security
                      dashboards.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 5: TEAM & RBAC MEMBERS */}
        {/* ================================================================= */}
        <TabsContent value="team" className="space-y-6 mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tenant Team Members &amp; RBAC
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage users provisioned in {user?.organizationName || 'your workspace'} (
                  {teamMembers.length} Members)
                </CardDescription>
              </div>
              {!isInvitingMember && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsInvitingMember(true)}
                  className="gap-1.5 text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite Member
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invite Success Feedback */}
              {inviteSuccess && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center gap-2 text-xs font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Team member provisioned and saved to PostgreSQL successfully.</span>
                </div>
              )}

              {/* Invite Member Form */}
              {isInvitingMember && (
                <form
                  onSubmit={handleInviteMember}
                  className="p-4 rounded-lg bg-muted/40 border border-border space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">
                      Provision New Team Member
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsInvitingMember(false)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                  </div>

                  {inviteError && (
                    <div className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                      {inviteError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="memberName">Full Name *</Label>
                      <Input
                        id="memberName"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        disabled={isSubmittingInvite}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="memberEmail">Email Address *</Label>
                      <Input
                        id="memberEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="e.g. priya@acmeinfra.com"
                        disabled={isSubmittingInvite}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="memberRole">Assigned Role *</Label>
                      <select
                        id="memberRole"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        disabled={isSubmittingInvite}
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="BID_MANAGER">Bid Manager</option>
                        <option value="LEGAL_COUNSEL">Legal Counsel</option>
                        <option value="FINANCIAL_CONTROLLER">Financial Controller</option>
                        <option value="TECHNICAL_LEAD">Technical Lead</option>
                        <option value="VIEWER">Viewer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      disabled={isSubmittingInvite || !inviteEmail.trim() || !inviteName.trim()}
                    >
                      {isSubmittingInvite ? 'Provisioning...' : 'Add Team Member'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Team Members List */}
              <div className="space-y-2">
                {isTeamLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Loading team members...
                  </p>
                ) : teamMembers.length > 0 ? (
                  teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-xs">
                              {member.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-semibold"
                            >
                              {member.role.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{member.email}</span>
                            {member.phone && <span>• {member.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {member.permissions.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                          >
                            {p}
                          </span>
                        ))}
                        {member.permissions.length > 3 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            +{member.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No team members found.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 6: MULTI-COMPANY LEGAL ENTITIES */}
        {/* ================================================================= */}
        <TabsContent value="companies" className="space-y-6 mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  Registered Company Legal Entities
                </CardTitle>
                <CardDescription className="text-xs">
                  Legal business entities evaluated under this tenant workspace ({companies.length}{' '}
                  Registered)
                </CardDescription>
              </div>
              {!isAddingCompany && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddingCompany(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Legal Entity
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Company Inline Form */}
              {isAddingCompany && (
                <form
                  onSubmit={handleCreateCompany}
                  className="p-4 rounded-lg bg-muted/40 border border-border space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">
                      Register New Legal Business Entity
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingCompany(false)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="newLegalName">Legal Company Name *</Label>
                      <Input
                        id="newLegalName"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="e.g. Acme Solar Solutions Pvt Ltd"
                        disabled={isSubmittingCompany}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="newGstinVal">GSTIN (Optional)</Label>
                      <Input
                        id="newGstinVal"
                        value={newGstin}
                        onChange={(e) => setNewGstin(e.target.value)}
                        placeholder="e.g. 27AAKCA9999F1Z9"
                        disabled={isSubmittingCompany}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      disabled={isSubmittingCompany || !newCompanyName.trim()}
                    >
                      {isSubmittingCompany ? 'Registering...' : 'Add Business Entity'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Companies List */}
              <div className="space-y-3">
                {companies.map((company) => {
                  const isSelected = company.id === selectedCompanyId;
                  return (
                    <div
                      key={company.id}
                      className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-primary/5 border-primary/40 shadow-xs'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground text-sm truncate">
                            {company.legalName}
                          </span>
                          {isSelected && (
                            <Badge variant="default" className="text-[10px]">
                              Active Context
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {company.gstin && (
                            <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                              GST: {company.gstin}
                            </span>
                          )}
                          {company.constitution && (
                            <span className="capitalize">
                              {company.constitution.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          )}
                          <span className="font-mono text-[10px]">ID: {company.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isSelected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCompanyId(company.id)}
                            className="text-xs"
                          >
                            Set as Active
                          </Button>
                        )}
                        <Link to="/company-profile">
                          <Button variant="secondary" size="sm" className="gap-1 text-xs">
                            <span>Capability Dossier</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
