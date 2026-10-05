import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { useCompany } from '../context/CompanyContext.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Switch } from '../components/ui/switch.js';
import { Separator } from '../components/ui/separator.js';
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
  Info,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { companies, selectedCompanyId, setSelectedCompanyId, createCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'general';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Local notification preference states
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyEvidenceExpiry, setNotifyEvidenceExpiry] = useState(true);
  const [notifyReviewRequests, setNotifyReviewRequests] = useState(true);
  const [notifyHighRiskFlags, setNotifyHighRiskFlags] = useState(true);

  // New Company form in Company tab
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace &amp; System Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure tenant workspace parameters, multi-company entities, security policies, and alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Tenant: {user?.organizationId || 'org_acme_infra_001'}
          </Badge>
        </div>
      </div>

      {/* 2. Settings Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/60 p-1 rounded-lg border border-border">
          <TabsTrigger value="general" className="gap-2 text-xs">
            <Settings className="h-3.5 w-3.5" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 text-xs">
            <Bell className="h-3.5 w-3.5" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>Team &amp; RBAC</span>
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 text-xs">
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
              <CardTitle className="text-base font-semibold">Tenant Workspace Configuration</CardTitle>
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
                    value={user?.organizationName || 'Acme Infrastructure Workspace'}
                    disabled
                    className="bg-muted/40 text-muted-foreground cursor-not-allowed"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    SaaS organization tenant boundary identifier
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenantId">Tenant Organization ID</Label>
                  <Input
                    id="tenantId"
                    value={user?.organizationId || 'org_acme_infra_001'}
                    disabled
                    className="bg-muted/40 font-mono text-muted-foreground cursor-not-allowed"
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
                  Select which registered company is automatically selected when you launch new tenders or review dossiers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {companies.map((company) => {
                    const isSelected = company.id === selectedCompanyId;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => setSelectedCompanyId(company.id)}
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
                  <p className="font-medium text-foreground">India Public Procurement (GeM / CPPP)</p>
                  <p className="text-[10px] text-muted-foreground">INR Currency (₹ Lakhs / Crores)</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Data Residency &amp; Compliance
                  </span>
                  <p className="font-medium text-foreground">AWS ap-south-1 (Mumbai)</p>
                  <p className="text-[10px] text-muted-foreground">DPDP Act 2023 Compliant Storage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: NOTIFICATION PREFERENCES */}
        {/* ================================================================= */}
        <TabsContent value="notifications" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Tender Alert Preferences</CardTitle>
              <CardDescription className="text-xs">
                Control in-app status banners and critical procurement timeline alerts
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
                    checked={notifyDeadlines}
                    onCheckedChange={setNotifyDeadlines}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyEvidenceExpiry" className="text-xs font-semibold">
                      Company Evidence Expiration Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Notify when CA UDIN certificates, solvency letters, or ISO audits are expiring within 90 days
                    </p>
                  </div>
                  <Switch
                    id="notifyEvidenceExpiry"
                    checked={notifyEvidenceExpiry}
                    onCheckedChange={setNotifyEvidenceExpiry}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyReviewRequests" className="text-xs font-semibold">
                      Human Review Task Requests
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Flag tender clauses requiring manual sign-off by Legal Counsel or Financial Controller
                    </p>
                  </div>
                  <Switch
                    id="notifyReviewRequests"
                    checked={notifyReviewRequests}
                    onCheckedChange={setNotifyReviewRequests}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyHighRiskFlags" className="text-xs font-semibold">
                      Critical Disqualification Risk Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Highlight Liquidated Damages caps exceeding 10% or non-refundable EMD forfeiture clauses
                    </p>
                  </div>
                  <Switch
                    id="notifyHighRiskFlags"
                    checked={notifyHighRiskFlags}
                    onCheckedChange={setNotifyHighRiskFlags}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-accent/40 border border-border flex items-start gap-2.5 text-xs">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Backend Notification Infrastructure Note</span>
                  <p>
                    In-app visual status alerts are active immediately. Outbound automated email and webhook dispatch
                    endpoints are planned for the upcoming notification service milestone.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: SECURITY & SESSION POLICIES */}
        {/* ================================================================= */}
        <TabsContent value="security" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Session Security &amp; Token Architecture</CardTitle>
              <CardDescription className="text-xs">
                Active cryptographic session properties and isolation enforcement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Cryptographic Token Session</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Access is signed using RFC 7519 HMAC-SHA256 tokens with timing-safe signature verification.
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
                    Every API request executes in an isolated Node.js AsyncLocalStorage fiber with anti-IDOR filters.
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
                      <span className="font-semibold text-foreground">Two-Factor Authentication (2FA)</span>
                      <Badge variant="outline" className="text-[10px]">Roadmap</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Time-based One-Time Password (TOTP) enforcement for administrative role changes.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Audit Log Export (SIEM)</span>
                      <Badge variant="outline" className="text-[10px]">Roadmap</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Stream cryptographic audit event logs directly to external security dashboards.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: TEAM & RBAC PERMISSIONS */}
        {/* ================================================================= */}
        <TabsContent value="team" className="space-y-6 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Tenant Role-Based Access Control (RBAC)</CardTitle>
              <CardDescription className="text-xs">
                Permission matrix and functional responsibilities across your procurement team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">Your Active Assigned Role</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assigned within {user?.organizationName || 'Default Workspace'}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold uppercase px-2.5 py-1">
                  {user?.role?.replace(/_/g, ' ') || 'User'}
                </Badge>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Supported Tenant Roles &amp; Scopes
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">ADMIN</span>
                      <span className="font-mono text-[10px] text-primary">Wildcard Scopes (*)</span>
                    </div>
                    <p className="text-muted-foreground">
                      Full workspace administration, tender project creation, deletion, and company capability publishing.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">BID_MANAGER</span>
                      <span className="font-mono text-[10px] text-primary">bids:create, bids:update, compliance:review</span>
                    </div>
                    <p className="text-muted-foreground">
                      Creates tender projects, uploads tender NIT volumes, and manages compliance matrices.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">LEGAL_COUNSEL &amp; FINANCIAL_CONTROLLER</span>
                      <span className="font-mono text-[10px] text-primary">bids:read, compliance:review</span>
                    </div>
                    <p className="text-muted-foreground">
                      Performs formal Human-in-the-Loop review sign-offs with mandatory audit justifications.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">VIEWER</span>
                      <span className="font-mono text-[10px] text-muted-foreground">bids:read</span>
                    </div>
                    <p className="text-muted-foreground">
                      Read-only inspection of tenders, compliance matrices, and readiness scores.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 5: MULTI-COMPANY LEGAL ENTITIES */}
        {/* ================================================================= */}
        <TabsContent value="companies" className="space-y-6 mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Registered Company Legal Entities</CardTitle>
                <CardDescription className="text-xs">
                  Legal business entities evaluated under this tenant workspace ({companies.length} Registered)
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
                    <h4 className="text-xs font-semibold text-foreground">Register New Legal Business Entity</h4>
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
                          <span className="font-mono text-[10px]">
                            ID: {company.id}
                          </span>
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
