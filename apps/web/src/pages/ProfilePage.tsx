import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { getMe, updateMe, changePassword, type UserProfile } from '../api/users.js';
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
  Key,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Change password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      const res = await getMe();
      if (res.ok) {
        setProfile(res.data);
        setNameInput(res.data.name);
        setPhoneInput(res.data.phone || '');
      } else if (user) {
        setProfile({
          id: user.id,
          email: user.email,
          name: user.name,
          phone: null,
          role: user.role,
          permissions: user.permissions,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
        });
        setNameInput(user.name);
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [user]);

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

  const displayName = profile?.name || user?.name || 'Authenticated User';
  const displayEmail = profile?.email || user?.email || '';
  const displayRole = profile?.role || user?.role || 'User';
  const initials = getInitials(displayName, displayEmail);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setSaveError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const res = await updateMe({
      name: nameInput.trim(),
      phone: phoneInput.trim() || undefined,
    });

    setIsSaving(false);

    if (res.ok) {
      setProfile(res.data);
      // Synchronize in-memory auth storage
      if (user) {
        const updated = { ...user, name: res.data.name };
        localStorage.setItem('tp_user_profile', JSON.stringify(updated));
      }
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(res.error.message || 'Failed to update profile settings.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsSubmittingPassword(true);
    setPasswordError(null);

    const res = await changePassword({ currentPassword, newPassword });
    setIsSubmittingPassword(false);

    if (res.ok) {
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(false), 4000);
    } else {
      setPasswordError(res.error.message || 'Failed to update password.');
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

      {/* 2. Tenant Workspace Profile Banner */}
      <div className="p-4 sm:p-5 rounded-lg bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tenant:
              </span>
              <span className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                {profile?.organizationName || user?.organizationName || 'Acme Infrastructure Sol'}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
                Multi-Tenant Isolated
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>Tenant ID: {profile?.organizationId || user?.organizationId || 'org_acme_infra_001'}</span>
              <span>•</span>
              <span>Role: {(profile?.role || user?.role || 'User').replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link to="/settings">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Tenant Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* 3. Distinction Banner: User vs Company Capability */}
      <div className="p-3.5 rounded-lg bg-accent/40 border border-border flex items-start gap-3 text-xs">
        <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Personal Profile vs Company Dossier</span>
          <p className="text-muted-foreground leading-relaxed">
            This page represents your individual user identity. To manage company registrations,
            GSTINs, CA UDIN certificates, or past contracts, visit the{' '}
            <Link to="/company-profile" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">
              Company Capability Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>
        </div>
      </div>

      {/* 3. Feedback Messages */}
      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Profile changes saved and persisted to backend successfully.</span>
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
          {saveError}
        </div>
      )}
      {passwordSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Password changed and encrypted with bcrypt successfully.</span>
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
                setNameInput(displayName);
                setPhoneInput(profile?.phone || '');
                setIsEditing(true);
              }}
              className="gap-1.5 text-xs"
              disabled={isLoading}
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
                  {displayName}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                  {displayRole.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{displayEmail}</p>
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
                <Label htmlFor="phoneField">Phone Number (Optional)</Label>
                <Input
                  id="phoneField"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emailReadonly">Email Address</Label>
                <Input
                  id="emailReadonly"
                  value={displayEmail}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed font-mono text-xs"
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
                <p className="font-medium text-foreground">{displayName}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email Address
                </span>
                <p className="font-medium text-foreground">{displayEmail}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Phone Number
                </span>
                <p className="font-medium text-foreground">{profile?.phone || 'Not provided'}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned Workspace Role
                </span>
                <p className="font-medium text-foreground">{displayRole.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Password & Authentication Security Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Security &amp; Password</CardTitle>
            <CardDescription className="text-xs">
              Manage your bcrypt-encrypted password credentials
            </CardDescription>
          </div>
          {!isChangingPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordError(null);
                setIsChangingPassword(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Key className="h-3.5 w-3.5" />
              Change Password
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isChangingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              {passwordError && (
                <div className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {passwordError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="currPass">Current Password *</Label>
                <Input
                  id="currPass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isSubmittingPassword}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPass">New Password (min 8 characters) *</Label>
                <Input
                  id="newPass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmittingPassword}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confPass">Confirm New Password *</Label>
                <Input
                  id="confPass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmittingPassword}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(false)}
                  disabled={isSubmittingPassword}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isSubmittingPassword || !currentPassword || !newPassword}
                >
                  {isSubmittingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Password encrypted with bcrypt standard</span>
              </div>
              <Badge variant="outline" className="text-[10px]">Secure</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Workspace & Permissions Card */}
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
              <p className="font-medium text-foreground">{profile?.organizationName || user?.organizationName || 'Default Workspace'}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Organization Tenant ID
              </span>
              <p className="font-mono text-foreground">{profile?.organizationId || user?.organizationId || 'org_acme_infra_001'}</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Active Permissions List
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {(profile?.permissions || user?.permissions)?.length || 0} Scopes
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(profile?.permissions || user?.permissions)?.map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Session Security & Compliance Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Session Security &amp; Token Architecture</CardTitle>
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
