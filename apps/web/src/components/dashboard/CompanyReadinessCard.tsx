import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card.js';
import {
  Building2,
  ShieldCheck,
  Award,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  getCompanyProfile,
  getExpiringCertificates,
  type CompanyProfileView,
  type ExpiringCertificatesResponse,
} from '../../api/companyProfile.js';
import { Badge } from '../ui/badge.js';

/**
 * Company Readiness — Live Company Capability Profile aggregate
 * evaluated deterministically against incoming tender requirements.
 *
 * Grounded in live backend endpoints:
 *   - GET /api/v1/company-profile
 *   - GET /api/v1/company-profile/expiring-certificates
 */
export const CompanyReadinessCard: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfileView | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCertificatesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getCompanyProfile(), getExpiringCertificates(90)])
      .then(([profRes, expRes]) => {
        if (!isMounted) return;
        if (profRes.ok && profRes.data) {
          setProfile(profRes.data);
        }
        if (expRes.ok && expRes.data) {
          setExpiring(expRes.data);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activePayload = profile?.active?.payload;
  const activeVersion = profile?.active;

  // Compute capability rollups
  const regCount = activePayload?.registrations
    ? Object.keys(activePayload.registrations).length
    : 0;

  const turnoverRecords = activePayload?.turnover_records || [];
  const avgTurnover =
    turnoverRecords.length > 0
      ? turnoverRecords.reduce((sum, r) => sum + (Number(r.turnover_inr_crores) || 0), 0) /
        turnoverRecords.length
      : 0;

  const experienceList = activePayload?.experience || [];
  const largestProject =
    experienceList.length > 0
      ? Math.max(...experienceList.map((e) => Number(e.contract_value_inr_crores) || 0))
      : 0;

  const certCount = activePayload?.certifications?.length || 0;
  const oemCount = activePayload?.oem_authorizations?.length || 0;

  const expiringList = expiring?.certificates || [];
  const urgentExpiring = expiringList.filter((c) => c.isUrgent || c.isExpired);

  return (
    <Card className="border-border/60 bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Company Capability Profile
            </CardTitle>
          </div>
          {activeVersion && (
            <Link
              to="/company-profile"
              className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
            >
              <Badge
                variant="outline"
                className="bg-muted text-foreground border-border text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="h-3 w-3" />v{activeVersion.version} Active
              </Badge>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors hidden sm:inline font-mono">
                {activePayload?.company_name}
              </span>
            </Link>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Persistent enterprise credentials &amp; audited financial track record evaluated against
          tender requirements
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 flex flex-col gap-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : !activePayload ? (
          <div className="p-4 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center">
            <p className="text-xs text-muted-foreground">
              No active company capability profile configured for this organization.
            </p>
          </div>
        ) : (
          <>
            {/* 4 Capability Pillar Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pillar 1: Registrations */}
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    Registrations
                  </span>
                  <ShieldCheck className="h-4 w-4 text-primary/80" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {regCount}{' '}
                    <span className="text-xs font-normal text-muted-foreground font-sans">
                      Active
                    </span>
                  </div>
                  <div className="text-[11px] text-foreground/80 font-medium mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    GSTIN, PAN, Udyam, GeM
                  </div>
                </div>
              </div>

              {/* Pillar 2: 3-Year Avg Turnover */}
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    3-Yr Avg Turnover
                  </span>
                  <TrendingUp className="h-4 w-4 text-primary/80" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    ₹{avgTurnover.toFixed(1)}{' '}
                    <span className="text-xs font-normal text-muted-foreground font-sans">Cr</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {turnoverRecords.length} FYs CA Audited (UDIN)
                  </div>
                </div>
              </div>

              {/* Pillar 3: Past Qualifying Works */}
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    7-Yr Experience
                  </span>
                  <FileCheck2 className="h-4 w-4 text-primary/80" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {experienceList.length}{' '}
                    <span className="text-xs font-normal text-muted-foreground font-sans">
                      Work Orders
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Max: ₹{largestProject.toFixed(1)} Cr EPC Project
                  </div>
                </div>
              </div>

              {/* Pillar 4: Certifications & OEMs */}
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    ISO &amp; OEM Authorizations
                  </span>
                  <Award className="h-4 w-4 text-primary/80" />
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    {certCount + oemCount}{' '}
                    <span className="text-xs font-normal text-muted-foreground font-sans">
                      Credentials
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {certCount} ISO/CMMI • {oemCount} OEM MAFs
                  </div>
                </div>
              </div>
            </div>

            {/* Expiry Warning Callout if urgent */}
            {urgentExpiring.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-amber-200">
                    Certificate Expiry Watch ({urgentExpiring.length} item
                    {urgentExpiring.length > 1 ? 's' : ''})
                  </span>
                  <div className="flex flex-col gap-1 mt-0.5">
                    {urgentExpiring.map((cert) => (
                      <div
                        key={cert.entryId}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-amber-300 font-medium">{cert.name}</span>
                        <span className="text-amber-400 font-mono">
                          {cert.isExpired ? 'EXPIRED' : `Expires in ${cert.daysRemaining} days`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Transparency Guarantee */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Layers className="h-3.5 w-3.5 text-primary/80" />
                Evaluated deterministically against all incoming tender requirements
              </span>
              <Link
                to="/company-profile"
                className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-[11px] transition-colors"
              >
                View Full Dossier
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
