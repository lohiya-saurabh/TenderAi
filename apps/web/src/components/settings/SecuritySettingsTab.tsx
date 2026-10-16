import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Separator } from '@/components/ui/separator.js';
import { ShieldCheck, Lock } from 'lucide-react';

export const SecuritySettingsTab: React.FC = () => {
  return (
    <div className="space-y-6">
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
    </div>
  );
};
