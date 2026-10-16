import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { type PlanTier } from '@/api/billing.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Building2, Lock, Mail, User, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const selectedPlan = (searchParams.get('plan') as PlanTier) || 'GROWTH';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !companyName.trim()) {
      setError('Please fill in your name, email, password, and primary company legal name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      organizationName: organizationName.trim() || undefined,
      companyName: companyName.trim(),
      gstin: gstin.trim() || undefined,
      planTier: selectedPlan,
    });

    setIsSubmitting(false);

    if (res.success) {
      navigate('/onboarding', { replace: true });
    } else {
      setError(res.error || 'Failed to create workspace account.');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
            TP
          </div>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your TenderPulse workspace
        </h1>
        <p className="text-xs text-muted-foreground">
          Start evaluating Indian public tenders with deterministic compliance scoring
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-card text-card-foreground py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-border space-y-6">
          {/* Selected Plan Banner */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground">Selected Tier: </span>
                <span className="font-semibold text-foreground font-mono">{selectedPlan}</span>
              </div>
            </div>
            <Link to="/pricing" className="text-[11px] text-primary hover:underline">
              Change Plan
            </Link>
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs">
                  Full Name *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vikramaditya Rao"
                    className="pl-9 text-xs"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workEmail" className="text-xs">
                  Work Email *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="workEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vikram@sharmaprojects.in"
                    className="pl-9 text-xs"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="passwordVal" className="text-xs">
                Password (min 8 chars) *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="passwordVal"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="pl-9 text-xs"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Workspace &amp; Company Setup
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName" className="text-xs">
                    Workspace / Organization Name (Optional)
                  </Label>
                  <Input
                    id="orgName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Apex Infrastructure Solutions"
                    className="text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="compName" className="text-xs">
                      Primary Company Legal Name *
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="compName"
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apex Infra Pvt Ltd"
                        className="pl-9 text-xs"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gstinVal" className="text-xs">
                      GSTIN (Optional)
                    </Label>
                    <Input
                      id="gstinVal"
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="27AAACX1234F1Z5"
                      className="text-xs font-mono"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full text-xs font-semibold gap-2 shadow-xs"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Creating Workspace...' : 'Create SaaS Workspace'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>

          <div className="pt-4 border-t border-border/60 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in to workspace
              </Link>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>Isolated Tenant DB &bull; DPDP Act 2023 Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
