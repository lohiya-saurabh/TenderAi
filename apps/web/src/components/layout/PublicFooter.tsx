import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-border/80 bg-card text-muted-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Brand & Overview */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                TP
              </div>
              <span className="text-base font-bold text-foreground tracking-tight">
                TenderPulse AI
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tender Intelligence &amp; Bid Readiness SaaS purpose-built for Indian contractors, MSMEs, and public sector vendors.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>DPDP Act 2023 &bull; GeM / CPPP Ready</span>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Platform Workflow
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="/#features" className="hover:text-foreground transition-colors">
                  NIT Clause Extraction
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-foreground transition-colors">
                  Bid / No-Bid Engine
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-foreground transition-colors">
                  Multi-Company Evidence
                </a>
              </li>
              <li>
                <a href="/#features" className="hover:text-foreground transition-colors">
                  Disqualification Risk Audits
                </a>
              </li>
              <li>
                <a href="/#workflow" className="hover:text-foreground transition-colors">
                  Human Sign-off Queue
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Resources & Plans */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Product &amp; Pricing
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/pricing" className="hover:text-foreground transition-colors">
                  Plans &amp; Subscriptions
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-foreground transition-colors">
                  Register Organization
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground transition-colors">
                  Workspace Login
                </Link>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-not-allowed">
                  GeM API Integration (Coming Soon)
                </span>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Security &amp; Isolation
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">
                  Fiber-Safe Tenant Isolation with strict anti-IDOR filters.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">
                  Deterministic audit trail for all human compliance overrides.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">
                  Data stored securely in AWS Mumbai region.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TenderPulse AI. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security Whitepaper</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
