import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { ShieldCheck, ArrowLeft, Lock, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/bids';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
            TP
          </div>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sign in to TenderPulse AI
        </h1>
        <p className="text-xs text-muted-foreground">
          Deterministic Bid Evaluation &amp; Compliance Verification Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card text-card-foreground py-8 px-6 shadow-xl sm:rounded-xl sm:px-8 border border-border space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
            <span className="text-[11px] font-mono text-muted-foreground">v2.4 Enterprise</span>
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bid.manager@infrastructure.in"
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={isSubmitting}
              className="w-full mt-2 font-semibold shadow-sm"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Workspace →'}
            </Button>
          </form>

          <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground space-y-3">
            <p>
              New organization?{' '}
              <Link to="/signup" className="text-primary hover:underline font-semibold">
                Register Workspace
              </Link>
            </p>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
              <span>Protected by Fiber-Safe Tenant Isolation &amp; RBAC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
