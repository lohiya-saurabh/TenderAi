import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { Avatar, AvatarFallback } from '../components/ui/avatar.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Separator } from '../components/ui/separator.js';
import {
  ShieldCheck,
  Building2,
  Lock,
  CheckCircle2,
  ExternalLink,
  Edit2,
  KeyRound,
  Layers,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'TP';
  };

  const initials = getInitials(user?.name, user?.email);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setSaveError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Update local authenticated user state in session storage
      if (user) {
        const updatedUser = { ...user, name: nameInput.trim() };
        localStorage.setItem('tp_user_profile', JSON.stringify(updatedUser));
      }
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('Failed to update profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Profile</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your personal identity, credentials, and tenant workspace permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5" />
              Workspace Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Distinction Banner: User vs Company Capability */}
      <div className="p-3.5 rounded-lg bg-accent/40 border border-border flex items-start gap-3 text-xs">
        <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Personal Profile vs Company Dossier</span>
          <p className="text-muted-foreground leading-relaxed">
            This page represents your individual authenticated user profile. To manage legal business entity
            registrations, CA UDIN certificates, financial turnover, or past work experience, visit the{' '}
            <Link to="/company-profile" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">
              Company Capability Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>
        </div>
      </div>

      {/* 3. Success / Error Feedback */}
      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Profile changes updated successfully for the current session.</span>
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
          {saveError}
        </div>
      )}

      {/* 4. Personal Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
            <CardDescription className="text-xs">
              Your personal credentials and display information across tender evaluation logs
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameInput(user?.name || '');
                setIsEditing(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Information
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border shadow-xs">
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                  {user?.name || 'Authenticated User'}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                  {user?.role?.replace(/_/g, ' ') || 'User'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                Avatar initials derived from verified name
              </p>
            </div>
          </div>

          <Separator />

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  disabled={isSaving}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emailReadonly">Email Address</Label>
                <Input
                  id="emailReadonly"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <span className="text-[10px] text-muted-foreground">
                  Email address is bound to your SaaS tenant authentication identity
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isSaving || !nameInput.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Name
                </span>
                <p className="font-medium text-foreground">{user?.name || '—'}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email Address
                </span>
                <p className="font-medium text-foreground">{user?.email || '—'}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned Workspace Role
                </span>
                <p className="font-medium text-foreground">{user?.role?.replace(/_/g, ' ') || '—'}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  User Identification Key
                </span>
                <p className="font-mono text-foreground">{user?.id || 'usr_anonymous'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Tenant Workspace & RBAC Permissions Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Workspace & Access Matrix</CardTitle>
          <CardDescription className="text-xs">
            SaaS tenant boundary and assigned authorization scopes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tenant Workspace
              </span>
              <p className="font-medium text-foreground">{user?.organizationName || 'Default Workspace'}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Organization Tenant ID
              </span>
              <p className="font-mono text-foreground">{user?.organizationId || 'org_acme_infra_001'}</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Active Permissions List
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {user?.permissions?.length || 0} Scopes
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {user?.permissions && user.permissions.length > 0 ? (
                user.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20"
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Standard viewer permissions</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Session Security & Compliance Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Security & Session Details</CardTitle>
          <CardDescription className="text-xs">
            Cryptographic token session and multi-tenant security guarantees
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                <span>HMAC-SHA256</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Signed cryptographic access token with continuous validity
              </p>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <Lock className="h-4 w-4" />
                <span>Tenant Gated</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fiber-safe anti-IDOR isolation applied on every API query
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span>OCC Protected</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optimistic concurrency control across compliance reviews
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
