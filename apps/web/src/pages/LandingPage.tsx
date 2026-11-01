import React from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/layout/PublicNav.js';
import { PublicFooter } from '@/components/layout/PublicFooter.js';
import { PlanCards } from '@/components/billing/PlanCards.js';
import { Button } from '@/components/ui/button.js';
import { Badge, type BadgeVariant } from '@/components/common/Badge.js';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileSearch,
  FileStack,
  FolderCheck,
  GitCompareArrows,
  ListChecks,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

/**
 * Public landing page. Every claim here must be true of the product today: no statistics without
 * a source, no "deterministic extraction" (extraction uses an AI model and is validated against
 * the source), no export or discovery features that are not built yet.
 */

const SAMPLE_CLAUSES: {
  title: string;
  page: number;
  note: string;
  status: string;
  tone: BadgeVariant;
}[] = [
  {
    title: 'Average annual turnover, last 3 years',
    page: 14,
    note: 'Linked: audited turnover certificate',
    status: 'Met',
    tone: 'success',
  },
  {
    title: 'One similar work completed',
    page: 15,
    note: 'No completion certificate in your evidence',
    status: 'Gap',
    tone: 'danger',
  },
  {
    title: 'Valid ISO 9001 certificate',
    page: 22,
    note: 'Expires before the bid due date',
    status: 'Expired',
    tone: 'warning',
  },
];

const PROBLEMS = [
  {
    icon: FileStack,
    title: 'Requirements are spread over hundreds of pages',
    body: 'Eligibility, special conditions, forms and corrigenda sit in separate PDFs. One missed line can be enough to be rejected.',
  },
  {
    icon: FolderCheck,
    title: 'Proof lives in folders, not against the clause',
    body: 'Turnover certificates, completion certificates and registrations are hard to match to the exact clause that asks for them.',
  },
  {
    icon: GitCompareArrows,
    title: 'Documents contradict each other',
    body: 'The NIT says one thing, the bid data sheet or a corrigendum says another. Someone has to notice before the bid goes in.',
  },
];

const STEPS = [
  {
    icon: FileSearch,
    title: 'Upload the tender',
    body: 'Every page is read. Each requirement is listed with the exact quote and page it came from, and pages that could not be read are flagged, not skipped.',
  },
  {
    icon: BookOpenCheck,
    title: 'Check each clause against the source',
    body: 'Review clauses side by side with the tender page. Conflicting clauses across documents are grouped so they are resolved once.',
  },
  {
    icon: ListChecks,
    title: 'Match your evidence',
    body: 'Your company profile and documents are linked to the clauses that need them. Missing or expired proof shows up as a gap.',
  },
  {
    icon: UserCheck,
    title: 'Decide and sign off',
    body: 'Bid or no-bid is worked out only from thresholds the tender states. Your team tracks what is ready and every decision is logged.',
  },
];

const SAFEGUARDS = [
  {
    title: 'Every clause cites its source.',
    body: 'A requirement is kept only if its quote is found on the cited page. Anything the tender does not state is shown as "Not stated", never filled in.',
  },
  {
    title: 'People make the decisions.',
    body: 'The AI reads and lists requirements. Confirming clauses, resolving conflicts and the final bid decision are done by your team.',
  },
  {
    title: 'Your workspace is yours.',
    body: 'Every query is scoped to your organisation, members join by one-time invite, and each review and status change is recorded in the audit trail.',
  },
];

const FAQ = [
  {
    q: 'Is the extraction done by AI?',
    a: 'Yes. An AI model reads each page and lists the requirements. Each one must quote the tender word for word, and the quote is checked against the page before it is shown. Pages the model could not handle are listed for manual review.',
  },
  {
    q: 'Does it replace our bid team?',
    a: 'No. It saves the reading and cross-checking. Your team confirms clauses, resolves conflicts and makes the bid decision.',
  },
  {
    q: 'Can we bid through more than one company?',
    a: 'Yes. One workspace can hold several companies, each with its own profile and evidence, and every bid is checked against the company bidding.',
  },
  {
    q: 'Who sees our documents?',
    a: 'Only members of your workspace. Documents are sent to an AI model to extract requirements and evidence details, and are otherwise kept within your workspace.',
  },
];

const Section: React.FC<{ id?: string; muted?: boolean; children: React.ReactNode }> = ({
  id,
  muted,
  children,
}) => (
  <section
    id={id}
    className={`border-b border-border py-16 sm:py-20 ${muted ? 'bg-muted/30' : ''}`}
  >
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
  </section>
);

const SectionTitle: React.FC<{ eyebrow: string; title: string; lead?: string }> = ({
  eyebrow,
  title,
  lead,
}) => (
  <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
    <p className="text-xs font-semibold text-primary">{eyebrow}</p>
    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
    {lead && <p className="text-sm text-muted-foreground sm:text-base">{lead}</p>}
  </div>
);

export const LandingPage: React.FC = () => (
  <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
    <PublicNav />

    <Section>
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-6 lg:col-span-7">
          <p className="text-xs font-semibold text-primary">
            Bid assurance for large works tenders
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            Catch every disqualifying clause before you submit.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            TenderPulse reads every page of the tender, lists each requirement with its exact quote
            and page, checks it against your company&apos;s evidence and shows your team what is
            still missing.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link to="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Free plan: one company and up to 3 tender analyses a month.
          </p>
        </div>

        <div className="lg:col-span-5">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-2xs font-semibold text-muted-foreground">Example</p>
                <p className="text-sm font-semibold text-foreground">
                  Road works tender · eligibility
                </p>
              </div>
              <Badge variant="warning" size="sm">
                2 gaps to close
              </Badge>
            </div>
            <ul className="space-y-2">
              {SAMPLE_CLAUSES.map((c) => (
                <li
                  key={c.title}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{c.title}</p>
                    <p className="text-2xs text-muted-foreground">
                      Page {c.page} · {c.note}
                    </p>
                  </div>
                  <Badge variant={c.tone} size="sm" className="shrink-0">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>

    <Section id="features" muted>
      <SectionTitle
        eyebrow="Why bids are rejected"
        title="Large works bids fail on details, not on capability"
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="space-y-3 rounded-xl border border-border bg-card p-6">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section id="workflow">
      <SectionTitle
        eyebrow="How it works"
        title="From tender PDF to a checked, signed-off bid"
        lead="Four steps, each with the source page one click away."
      />
      <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="space-y-3 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </Section>

    <Section id="security" muted>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Built so you can trust what it shows
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            A bid decision is only as good as the clause behind it, so every number and requirement
            leads back to the tender page it came from.
          </p>
        </div>
        <ul className="space-y-4">
          {SAFEGUARDS.map((s) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{s.title}</span> {s.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>

    <Section>
      <SectionTitle
        eyebrow="Pricing"
        title="Plans for single contractors and multi-company groups"
      />
      <PlanCards displayMode="all" showToggle={true} />
      <div className="pt-8 text-center">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Compare plans
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Section>

    <Section muted>
      <SectionTitle eyebrow="Questions" title="Frequently asked questions" />
      <dl className="mx-auto max-w-3xl space-y-4">
        {FAQ.map(({ q, a }) => (
          <div key={q} className="space-y-2 rounded-lg border border-border bg-card p-5">
            <dt className="text-sm font-semibold text-foreground">{q}</dt>
            <dd className="text-sm leading-relaxed text-muted-foreground">{a}</dd>
          </div>
        ))}
      </dl>
    </Section>

    <Section>
      <div className="mx-auto max-w-2xl space-y-5 text-center">
        <Users className="mx-auto h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Put your next tender through it before you submit
        </h2>
        <Button asChild size="lg" className="gap-2">
          <Link to="/signup">
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Section>

    <PublicFooter />
  </div>
);
