import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import type { NotificationPreferences } from '@/api/settings.js';

interface NotificationsSettingsTabProps {
  notifications: NotificationPreferences;
  isSavingSettings: boolean;
  onToggleNotification: (key: keyof NotificationPreferences, value: boolean) => void;
}

export const NotificationsSettingsTab: React.FC<NotificationsSettingsTabProps> = ({
  notifications,
  isSavingSettings,
  onToggleNotification,
}) => {
  return (
    <div className="space-y-6">
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
                onCheckedChange={(val) => onToggleNotification('notifyDeadlines', val)}
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
                onCheckedChange={(val) => onToggleNotification('notifyEvidenceExpiry', val)}
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
                onCheckedChange={(val) => onToggleNotification('notifyReviewRequests', val)}
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
                onCheckedChange={(val) => onToggleNotification('notifyHighRiskFlags', val)}
                disabled={isSavingSettings}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
