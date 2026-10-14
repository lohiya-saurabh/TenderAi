import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import { useCompany } from '../context/CompanyContext.js';
import { Button } from '../components/ui/button.js';
import { Label } from '../components/ui/label.js';
import { Badge } from '../components/ui/badge.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card.js';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  FileCheck2,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { verifyGstin, createCompanyProfileVersion } from '../api/companies.js';

const SECTORS = [
  'Civil Infrastructure & Highways',
  'Water Supply & Sewage (Jal Jeevan)',
  'Solar & Renewable EPC',
  'Electrical Transmission & Sub-stations',
  'Building Construction & MEP',
  'Smart City IT & Telecom',
];

export const OnboardingPage: React.FC = () => {
  const { user } = useAuth();
  const { companies, reloadCompanies } = useCompany();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([
    'Civil Infrastructure & Highways',
  ]);
  const [turnoverRange, setTurnoverRange] = useState<string>('50_to_250_cr');
  const [isFinishing, setIsFinishing] = useState(false);

  // IRIS IRP GSTIN Verification during onboarding
  const [gstinInput, setGstinInput] = useState('27AABCU9603R1ZM');
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);
  const [gstinVerifySuccess, setGstinVerifySuccess] = useState<string | null>(null);
  const [gstinVerifyError, setGstinVerifyError] = useState<string | null>(null);

  const handleVerifyGstin = async () => {
    if (!gstinInput.trim() || companies.length === 0) return;
    setIsVerifyingGstin(true);
    setGstinVerifyError(null);
    setGstinVerifySuccess(null);
    const targetCompId = companies[0]!.id;
    const res = await verifyGstin(targetCompId, gstinInput.trim().toUpperCase());
    setIsVerifyingGstin(false);
    if (res.ok) {
      setGstinVerifySuccess(
        `Verified with IRIS IRP: ${(res.data.data.legalName as string) || 'Taxpayer Active'}`,
      );
      await reloadCompanies();
    } else {
      setGstinVerifyError(res.error.message);
    }
  };

  const toggleSector = (sec: string) => {
    if (selectedSectors.includes(sec)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sec));
    } else {
      setSelectedSectors([...selectedSectors, sec]);
    }
  };

  const handleComplete = async () => {
    setIsFinishing(true);
    if (companies.length > 0 && companies[0]) {
      const compId = companies[0].id;
      try {
        await createCompanyProfileVersion(compId, {
          name: 'Onboarding Capability Baseline',
          payload: {
            company_name: companies[0].legalName || 'Enterprise Contractor',
            operating_regions: selectedSectors,
          },
        });
      } catch (err) {
        console.warn('[OnboardingPage] Failed to persist initial capabilities profile:', err);
      }
    }
    setTimeout(() => {
      navigate('/bids', { replace: true });
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto w-full space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-base mb-2 shadow-xs">
            TP
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to TenderPulse AI, {user?.name?.split(' ')[0] || 'Partner'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Let's configure your bidding profile in 3 quick steps
          </p>

          {/* Stepper Indicator */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                1
              </span>
              <span>Workspace</span>
            </div>
            <div className="w-8 h-[1px] bg-border" />
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                2
              </span>
              <span>Capabilities</span>
            </div>
            <div className="w-8 h-[1px] bg-border" />
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                3
              </span>
              <span>Launch</span>
            </div>
          </div>
        </div>

        {/* Step Cards */}
        <Card className="border-border shadow-xl bg-card">
          {/* STEP 1: WORKSPACE & COMPANY VERIFICATION */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  Step 1: Workspace &amp; Tenant Boundary
                </CardTitle>
                <CardDescription className="text-xs">
                  Your tenant isolation workspace has been initialized with the following
                  parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Workspace Name
                    </span>
                    <p className="font-semibold text-foreground">
                      {user?.organizationName || 'My Workspace'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Tenant: {user?.organizationId}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Admin Account
                    </span>
                    <p className="font-semibold text-foreground">{user?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Registered Company Entities</Label>
                  <div className="space-y-2">
                    {companies.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg border border-primary/40 bg-primary/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <p className="font-semibold text-xs text-foreground">{c.legalName}</p>
                            {c.gstin && (
                              <p className="text-[10px] font-mono text-muted-foreground">
                                GSTIN: {c.gstin}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.gstinVerifiedAt ? (
                            <Badge
                              variant="default"
                              className="text-[10px] bg-foreground text-background"
                            >
                              IRIS Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Active Entity
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instant GSTIN Verification with IRIS IRP */}
                <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        Verify Identity via IRIS IRP GSP
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Auto-imports official name &amp; PAN
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={gstinInput}
                      onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                      placeholder="Enter 15-character GSTIN (e.g. 27AABCU9603R1ZM)"
                      className="flex-1 px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground font-mono outline-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleVerifyGstin}
                      disabled={isVerifyingGstin || !gstinInput.trim()}
                      className="text-xs shrink-0"
                    >
                      {isVerifyingGstin ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Verifying...
                        </>
                      ) : (
                        'Fetch & Verify'
                      )}
                    </Button>
                  </div>

                  {gstinVerifySuccess && (
                    <div className="text-[11px] text-primary flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{gstinVerifySuccess}</span>
                    </div>
                  )}

                  {gstinVerifyError && (
                    <div className="text-[11px] text-red-500">{gstinVerifyError}</div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button onClick={() => setStep(2)} className="text-xs gap-1.5 font-semibold">
                    <span>Continue to Capabilities</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 2: CAPABILITY & SECTORS */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  Step 2: Core Sectors &amp; Financial Turnover
                </CardTitle>
                <CardDescription className="text-xs">
                  Helps our deterministic engine evaluate financial qualification formulas
                  accurately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Primary Contracting Sectors</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SECTORS.map((sec) => {
                      const isSelected = selectedSectors.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleSector(sec)}
                          className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-foreground font-semibold'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <span className="truncate">{sec}</span>
                          {isSelected && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turnoverSelect" className="text-xs font-semibold">
                    Average 3-Year Annual Turnover Range
                  </Label>
                  <select
                    id="turnoverSelect"
                    value={turnoverRange}
                    onChange={(e) => setTurnoverRange(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="under_10_cr">Under ₹10 Crores (MSME Micro / Small)</option>
                    <option value="10_to_50_cr">₹10 Crores - ₹50 Crores (Medium Enterprise)</option>
                    <option value="50_to_250_cr">₹50 Crores - ₹250 Crores (Mid-tier EPC)</option>
                    <option value="above_250_cr">
                      Above ₹250 Crores (Major Infrastructure Contractor)
                    </option>
                  </select>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} className="text-xs gap-1.5 font-semibold">
                    <span>Next: Ready to Launch</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* STEP 3: READY TO LAUNCH */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  Step 3: Setup Complete &amp; Ready
                </CardTitle>
                <CardDescription className="text-xs">
                  Your tenant profile is active and ready to ingest public tenders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Workspace &amp; Company Dossier Initialized</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    You can now upload NIT PDFs or evaluate sample tenders to test clause
                    extraction, missing evidence detection, and compliance scoring.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <FileCheck2 className="h-4 w-4 text-primary" />
                      <span>Create New Bid</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Upload your tender NIT or GeM bid document to start analysis.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Briefcase className="h-4 w-4 text-foreground" />
                      <span>Company Dossier</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Add CA certificates and past completion proofs anytime in settings.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-xs">
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={isFinishing}
                    className="text-xs gap-1.5 font-semibold shadow-xs"
                  >
                    <span>{isFinishing ? 'Entering Dashboard...' : 'Enter Tender Dashboard'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
