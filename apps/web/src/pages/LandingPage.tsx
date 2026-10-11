import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '../components/layout/PublicNav.js';
import { PublicFooter } from '../components/layout/PublicFooter.js';
import { PlanCards } from '../components/billing/PlanCards.js';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Card, CardContent } from '../components/ui/card.js';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Layers,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Check,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/30 selection:text-primary-foreground">
      <PublicNav />

      {/* ================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-border/60">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Hero Left Copy */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Built for Indian Public Procurement (GeM / CPPP)</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Know which tenders you can win —{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 via-orange-600 to-orange-500 dark:from-white dark:via-orange-400 dark:to-orange-500">
                  before wasting weeks preparing bids.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Deterministic tender clause extraction, multi-company evidence matching,
                instant Bid/No-Bid scoring, and audit-ready compliance dossiers for Indian contractors and MSMEs.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link to="/signup">
                  <Button size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold shadow-md">
                    <span>Start Free Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-sm font-medium">
                    <span>View Pricing Plans</span>
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-foreground" />
                  <span>Strict Tenant Data Isolation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Zero LLM Hallucination Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-orange-600" />
                  <span>Multi-Company Entities</span>
                </div>
              </div>
            </div>

            {/* Hero Right Visual Mockup: Live Tender Evaluation Preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-xl border border-border/90 bg-card p-5 shadow-2xl space-y-4">
                {/* Mock Card Header */}
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        NHAI-RO-DEL-2026-089
                      </Badge>
                      <Badge variant="outline" className="bg-foreground text-background text-[10px] font-bold">
                        BID RECOMMENDED
                      </Badge>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      Construction of 4-Lane Elevated Corridor (Pkg-02)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Estimated Value: ₹148.50 Cr &bull; EMD: ₹2.97 Cr
                    </p>
                  </div>
                </div>

                {/* Score & Verdict Meter */}
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Fit Score</span>
                    <p className="text-lg font-bold text-foreground">88.5%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Matched Clauses</span>
                    <p className="text-lg font-bold text-foreground">17 / 18</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Risk Level</span>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">Medium</p>
                  </div>
                </div>

                {/* Extracted Critical Clauses list */}
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Automated Requirement Matching
                  </span>

                  <div className="p-2.5 rounded border border-border bg-muted/30 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-[11px]">3-Year Average Annual Turnover</p>
                        <p className="text-[10px] text-muted-foreground">Required: ₹120 Cr &bull; Verified: ₹164.2 Cr (CA UDIN Valid)</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-foreground bg-muted shrink-0">PASS</Badge>
                  </div>

                  <div className="p-2.5 rounded border border-border bg-muted/30 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-[11px]">Similar Highway Completion Proof</p>
                        <p className="text-[10px] text-muted-foreground">Required: 1 project &gt; ₹100 Cr &bull; Matched: PWD NH-44 Expressway</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-foreground bg-muted shrink-0">PASS</Badge>
                  </div>

                  <div className="p-2.5 rounded border border-orange-500/25 bg-orange-500/5 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-[11px]">Liquidated Damages Clause (Sec 14.2)</p>
                        <p className="text-[10px] text-muted-foreground">High Risk: Penalty capped at 15% (Exceeds standard 10% ceiling)</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10 shrink-0">REVIEW</Badge>
                  </div>
                </div>

                {/* Card CTA */}
                <div className="pt-2 flex items-center justify-between border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Evaluation completed in 1.4s
                  </span>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Export Bid Dossier</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 2. THE PROBLEM (WHY BIDDERS FAIL) */}
      {/* ================================================================= */}
      <section id="features" className="py-20 border-b border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
              The Reality of Indian Bidding
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Why Indian contractors lose tenders before technical bids even open
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              Public procurement departments in India disqualify over 35% of bids during technical scrutiny due to missing certificates, overlooked restrictive clauses, or calculation mismatches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Problem 1 */}
            <Card className="bg-card border-border/80">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">500+ Page NIT Documents</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tender requirements, special conditions of contract (SCC), and turnover formulas are buried across massive multi-part PDFs.
                </p>
              </CardContent>
            </Card>

            {/* Problem 2 */}
            <Card className="bg-card border-border/80">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Scattered Evidence &amp; Proofs</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Past completion certificates, CA UDINs, and bank solvency letters live in disorganized drives, leading to missed submission deadlines.
                </p>
              </CardContent>
            </Card>

            {/* Problem 3 */}
            <Card className="bg-card border-border/80">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Disqualification Traps</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Unreasonable Liquidated Damages, aggressive bank guarantee forfeiture clauses, or joint venture restrictions get noticed too late.
                </p>
              </CardContent>
            </Card>

            {/* Problem 4 */}
            <Card className="bg-card border-border/80">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Multi-Entity Confusion</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Contractors operating through parent companies, subsidiaries, or consortiums struggle to pick the right legal entity with qualifying turnover.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. 6-STAGE WORKFLOW ENGINE */}
      {/* ================================================================= */}
      <section id="workflow" className="py-20 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
              Deterministic Bid Workflow
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              From raw tender PDF to audit-ready submission
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              A structured 6-stage lifecycle engineered for accuracy, evidence provenance, and team accountability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Stage 1 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 01</span>
                <Badge variant="outline" className="text-[10px]">Ingestion</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Tender Intelligence &amp; Ingestion</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload NIT, RFP, or BOQ documents. The engine extracts eligibility criteria, financial thresholds, EMD terms, and submission deadlines.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 02</span>
                <Badge variant="outline" className="text-[10px]">Evidence</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Multi-Company Evidence Match</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automatically evaluates your legal entities against tender criteria using your company dossier (turnover, past work certificates, machinery).
              </p>
            </div>

            {/* Stage 3 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 03</span>
                <Badge variant="outline" className="text-[10px]">Scoring</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Deterministic Bid/No-Bid Decision</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Receive an objective Fit Score (0-100%) and instant recommendation (BID, NO-BID, or CONDITIONAL) backed by hard matching facts.
              </p>
            </div>

            {/* Stage 4 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 04</span>
                <Badge variant="outline" className="text-[10px]">Compliance</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Clause-by-Clause Compliance Matrix</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review every mandatory technical and financial clause with exact PDF provenance, confidence scores, and missing document flags.
              </p>
            </div>

            {/* Stage 5 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 05</span>
                <Badge variant="outline" className="text-[10px]">Human Review</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Human-in-the-Loop Sign-off</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Legal Counsel, Bid Managers, and Financial Controllers review flagged items, apply overrides with audit justification, and sign off.
              </p>
            </div>

            {/* Stage 6 */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary">STAGE 06</span>
                <Badge variant="outline" className="text-[10px]">Submission</Badge>
              </div>
              <h3 className="text-base font-bold text-foreground">Audit-Ready Submission Packet</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Export full compliance matrices, signed qualification summaries, and document index packets ready for GeM or CPPP upload.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 4. ENTERPRISE SECURITY & ISOLATION */}
      {/* ================================================================= */}
      <section id="security" className="py-20 border-b border-border/60 bg-muted/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/60 text-foreground text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Zero Trust Tenant Security Architecture</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Enterprise tenant isolation. Your bidding intelligence stays yours.
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed">
                In government procurement, competitive confidentiality is paramount. TenderPulse AI enforces mathematical boundary isolation across tenants, companies, and database queries.
              </p>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Fiber-Safe Tenant Isolation: </span>
                    <span className="text-muted-foreground">Every incoming API execution runs inside Node.js AsyncLocalStorage. Cross-tenant leakage is architecturally impossible.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Never Hallucinated Decisions: </span>
                    <span className="text-muted-foreground">The LLM never makes tenant access or compliance decisions. All evaluations follow deterministic rule engines.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Immutable Audit Trail: </span>
                    <span className="text-muted-foreground">Every human override, review sign-off, and status change is logged with timestamp, user ID, and reasoning.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Visual Box */}
            <div className="p-6 rounded-xl border border-border bg-card/80 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted-foreground text-[11px]">SECURITY_ISOLATION_SPEC.md</span>
                <Badge variant="outline" className="text-[10px] text-foreground border-border bg-muted">
                  ENFORCED
                </Badge>
              </div>

              <div className="space-y-2 text-[11px] text-muted-foreground bg-muted/40 p-4 rounded-lg">
                <p className="text-foreground font-semibold">{'// 1 Tenant -> N Users | 1 Tenant -> N Companies'}</p>
                <p className="text-orange-600 dark:text-orange-400 font-mono">{'TenantContextHolder.run({ organizationId }, async () => {'}</p>
                <p className="pl-4 text-foreground">const bids = await db.query(</p>
                <p className="pl-8 text-foreground">"SELECT * FROM bids WHERE organization_id = $1",</p>
                <p className="pl-8 text-foreground">[context.organizationId]</p>
                <p className="pl-4 text-foreground">);</p>
                <p className="pl-4 text-muted-foreground">{'// Automatic anti-IDOR rejection on company mismatch'}</p>
                <p className="text-orange-600 dark:text-orange-400 font-mono">{'}'});</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                <div className="p-2.5 rounded bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[10px]">Data Residency</span>
                  <span className="font-semibold text-foreground">AWS Mumbai (ap-south-1)</span>
                </div>
                <div className="p-2.5 rounded bg-muted/30 border border-border/60">
                  <span className="text-muted-foreground block text-[10px]">Regulatory Alignment</span>
                  <span className="font-semibold text-foreground">DPDP Act 2023</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 5. PRICING & BUSINESS PLANS SECTION */}
      {/* ================================================================= */}
      <section className="py-20 border-b border-border/60 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">
              Transparent Tiered Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Plans built to scale with your bidding pipeline
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              From solo contractors analyzing local NITs to enterprise EPC conglomerates managing 15 sister companies and 150+ monthly tenders.
            </p>
          </div>

          {/* Embedded Business Plan Cards */}
          <PlanCards displayMode="all" showToggle={true} />

          <div className="pt-2 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>View Full Feature Comparison Matrix &amp; SLA Details</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 6. FAQ SECTION */}
      {/* ================================================================= */}
      <section className="py-20 border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
              Frequently Asked Questions
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              Everything you need to know about TenderPulse AI
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                How does TenderPulse extract clauses from 500-page NIT documents?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                Our ingestion pipeline processes PDF documents using structured section chunking, identifying Eligibility Criteria, Special Conditions of Contract (SCC), Turnovers, and Joint Venture limits while preserving exact page number provenance.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                Can I manage multiple sister companies or joint ventures in one account?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                Yes! TenderPulse is designed for 1 Tenant to N Companies. You can register multiple business entities (e.g. Acme Infra Pvt Ltd, Acme Solar LLP) each with their own GSTIN, turnover certificates, and past experience dossiers, and seamlessly switch contexts during evaluation.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                Does the AI replace our bidding team or legal counsel?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                No. TenderPulse AI accelerates the discovery and scoring phases, but enforces Human-in-the-Loop governance. All critical flags, risk waivers, and final submission sign-offs must be approved by designated team members (Bid Manager, Legal Counsel, Financial Controller).
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-card space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                Where is our sensitive tender and financial data stored?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                All data is encrypted in transit and at rest, hosted exclusively in AWS Mumbai (ap-south-1) in compliance with the Digital Personal Data Protection (DPDP) Act 2023. We never train public foundation models on your private bid documents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 7. FINAL CTA BANNER */}
      {/* ================================================================= */}
      <section className="py-20 relative overflow-hidden bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Stop losing tenders to fine print and missed clauses.
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Create your workspace today and analyze your first 3 tenders completely free. No credit card required.
          </p>
          <div className="pt-2 flex justify-center">
            <Link to="/signup">
              <Button size="lg" className="gap-2 text-sm font-semibold shadow-lg">
                <span>Get Started in 60 Seconds</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};
