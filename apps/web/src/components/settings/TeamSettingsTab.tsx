import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { UserPlus, CheckCircle2, User, Mail } from 'lucide-react';
import type { TeamMember } from '@/api/teams.js';

interface TeamSettingsTabProps {
  organizationName?: string;
  teamMembers: TeamMember[];
  isTeamLoading: boolean;
  isInvitingMember: boolean;
  inviteName: string;
  inviteEmail: string;
  inviteRole: string;
  isSubmittingInvite: boolean;
  inviteSuccess: boolean;
  inviteError: string | null;
  onSetIsInvitingMember: (val: boolean) => void;
  onSetInviteName: (val: string) => void;
  onSetInviteEmail: (val: string) => void;
  onSetInviteRole: (val: string) => void;
  onSubmitInvite: (e: React.FormEvent) => void;
}

export const TeamSettingsTab: React.FC<TeamSettingsTabProps> = ({
  organizationName,
  teamMembers,
  isTeamLoading,
  isInvitingMember,
  inviteName,
  inviteEmail,
  inviteRole,
  isSubmittingInvite,
  inviteSuccess,
  inviteError,
  onSetIsInvitingMember,
  onSetInviteName,
  onSetInviteEmail,
  onSetInviteRole,
  onSubmitInvite,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Tenant Team Members &amp; RBAC
            </CardTitle>
            <CardDescription className="text-xs">
              Manage users provisioned in {organizationName || 'your workspace'} (
              {teamMembers.length} Members)
            </CardDescription>
          </div>
          {!isInvitingMember && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSetIsInvitingMember(true)}
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
              onSubmit={onSubmitInvite}
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
                  onClick={() => onSetIsInvitingMember(false)}
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
                    onChange={(e) => onSetInviteName(e.target.value)}
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
                    onChange={(e) => onSetInviteEmail(e.target.value)}
                    placeholder="e.g. priya@acmeinfra.com"
                    disabled={isSubmittingInvite}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="memberRole">Assigned Role *</Label>
                  <select
                    id="memberRole"
                    value={inviteRole}
                    onChange={(e) => onSetInviteRole(e.target.value)}
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
    </div>
  );
};
