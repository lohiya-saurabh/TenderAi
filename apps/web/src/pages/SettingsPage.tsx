import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Building2,
  Bell,
  Shield,
  Users,
  Settings,
  CreditCard,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import { GeneralSettingsTab } from '@/components/settings/GeneralSettingsTab.js';
import { BillingSettingsTab } from '@/components/settings/BillingSettingsTab.js';
import { NotificationsSettingsTab } from '@/components/settings/NotificationsSettingsTab.js';
import { SecuritySettingsTab } from '@/components/settings/SecuritySettingsTab.js';
import { TeamSettingsTab } from '@/components/settings/TeamSettingsTab.js';
import { CompaniesSettingsTab } from '@/components/settings/CompaniesSettingsTab.js';

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

        <TabsContent value="general" className="space-y-6 mt-0">
          <GeneralSettingsTab
            workspaceSettings={workspaceSettings}
            organizationName={user?.organizationName}
            organizationId={user?.organizationId}
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectDefaultCompany={handleSelectDefaultCompany}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-0">
          <BillingSettingsTab
            subscription={subscription}
            usage={usage}
            plans={plans}
            isChangingPlan={isChangingPlan}
            billingFeedback={billingFeedback}
            onChangePlan={handleChangePlan}
            companiesCount={companies.length}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-0">
          <NotificationsSettingsTab
            notifications={notifications}
            isSavingSettings={isSavingSettings}
            onToggleNotification={handleToggleNotification}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-0">
          <SecuritySettingsTab />
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-0">
          <TeamSettingsTab
            organizationName={user?.organizationName}
            teamMembers={teamMembers}
            isTeamLoading={isTeamLoading}
            isInvitingMember={isInvitingMember}
            inviteName={inviteName}
            inviteEmail={inviteEmail}
            inviteRole={inviteRole}
            isSubmittingInvite={isSubmittingInvite}
            inviteSuccess={inviteSuccess}
            inviteError={inviteError}
            onSetIsInvitingMember={setIsInvitingMember}
            onSetInviteName={setInviteName}
            onSetInviteEmail={setInviteEmail}
            onSetInviteRole={setInviteRole}
            onSubmitInvite={handleInviteMember}
          />
        </TabsContent>

        <TabsContent value="companies" className="space-y-6 mt-0">
          <CompaniesSettingsTab
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompanyId={setSelectedCompanyId}
            isAddingCompany={isAddingCompany}
            newCompanyName={newCompanyName}
            newGstin={newGstin}
            isSubmittingCompany={isSubmittingCompany}
            onSetIsAddingCompany={setIsAddingCompany}
            onSetNewCompanyName={setNewCompanyName}
            onSetNewGstin={setNewGstin}
            onSubmitCompany={handleCreateCompany}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
