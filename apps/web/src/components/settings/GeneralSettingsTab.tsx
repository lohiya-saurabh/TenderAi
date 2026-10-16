import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Separator } from '@/components/ui/separator.js';
import { Building2, Check, Moon, Sun } from 'lucide-react';
import type { WorkspaceSettings } from '@/api/settings.js';
import type { CompanyItem } from '@/api/companies.js';

interface GeneralSettingsTabProps {
  workspaceSettings: WorkspaceSettings | null;
  organizationName?: string;
  organizationId?: string;
  companies: CompanyItem[];
  selectedCompanyId: string | null;
  onSelectDefaultCompany: (companyId: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  workspaceSettings,
  organizationName,
  organizationId,
  companies,
  selectedCompanyId,
  onSelectDefaultCompany,
  theme,
  toggleTheme,
}) => {
  return (
    <div className="space-y-6">
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
                value={workspaceSettings?.organizationName || organizationName || 'Workspace'}
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
                value={workspaceSettings?.organizationId || organizationId || '—'}
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
                    onClick={() => onSelectDefaultCompany(company.id)}
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
    </div>
  );
};
