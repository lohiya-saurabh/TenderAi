import React from 'react';
import { PublicNav } from '../components/layout/PublicNav.js';
import { PublicFooter } from '../components/layout/PublicFooter.js';
import { PlanCards } from '../components/billing/PlanCards.js';
import { Badge } from '../components/ui/badge.js';
import { Check, X } from 'lucide-react';

export const PricingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/30 selection:text-primary-foreground">
      <PublicNav />

      {/* Header Section */}
      <section className="pt-12 pb-12 md:pt-16 md:pb-16 border-b border-border/60 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">
            Subscription Pricing &amp; Entitlements
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight">
            Transparent plans for every bidding pipeline
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Scale seamlessly from single-contractor eligibility checks to multi-entity enterprise consortiums. Upgrade or downgrade anytime.
          </p>
        </div>
      </section>

      {/* 5-Tier Cards Section with Interactive Billing Toggle */}
      <section className="py-16 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PlanCards displayMode="all" showToggle={true} />
        </div>
      </section>

      {/* Feature Comparison Matrix Table */}
      <section className="py-20 border-b border-border/60 bg-muted/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
              Detailed Comparison
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
              Compare plans feature by feature
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-4 font-semibold text-foreground w-1/4">Feature / Capability</th>
                  <th className="p-4 font-semibold text-center text-foreground">Free</th>
                  <th className="p-4 font-semibold text-center text-foreground">Starter</th>
                  <th className="p-4 font-semibold text-center text-primary font-bold">Growth</th>
                  <th className="p-4 font-semibold text-center text-foreground">Business</th>
                  <th className="p-4 font-semibold text-center text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="p-4 font-medium text-foreground">Company Legal Entities</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">1</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">1</td>
                  <td className="p-4 text-center font-mono font-bold text-foreground">5</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">15</td>
                  <td className="p-4 text-center font-mono text-foreground font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Team Member Seats (RBAC)</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">1</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">3</td>
                  <td className="p-4 text-center font-mono font-bold text-foreground">10</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">25</td>
                  <td className="p-4 text-center font-mono text-foreground font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Monthly Tender Ingestions</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">3</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">15</td>
                  <td className="p-4 text-center font-mono font-bold text-foreground">50</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">150</td>
                  <td className="p-4 text-center font-mono text-foreground font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Evidence Document Storage</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">100 MB</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">1 GB</td>
                  <td className="p-4 text-center font-mono font-bold text-foreground">5 GB</td>
                  <td className="p-4 text-center font-mono text-muted-foreground">20 GB</td>
                  <td className="p-4 text-center font-mono text-foreground font-bold">100+ GB VPC</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Bid / No-Bid Recommendation Engine</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Disqualification Risk Alerts</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-muted-foreground/40 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Human-in-the-Loop Sign-off Workflow</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-muted-foreground/40 mx-auto" /></td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-muted-foreground/40 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">PDF Compliance Dossier Export</td>
                  <td className="p-4 text-center"><X className="h-4 w-4 text-muted-foreground/40 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-foreground mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-foreground">Dedicated Support &amp; SLA</td>
                  <td className="p-4 text-center text-muted-foreground">Community</td>
                  <td className="p-4 text-center text-muted-foreground">Standard Email</td>
                  <td className="p-4 text-center text-foreground font-semibold">Priority 24h</td>
                  <td className="p-4 text-center text-foreground font-semibold">Dedicated AM</td>
                  <td className="p-4 text-center text-foreground font-bold">24/7 Phone SLA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};
