import React, { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComplianceItem, reviewComplianceItem, type ComplianceItem } from '@/api/compliance.js';
import { useApi } from '@/hooks/useApi.js';
import { StatusBadge } from '@/components/common/StatusBadge.js';
import { RiskBadge } from '@/components/common/RiskBadge.js';
import { Badge } from '@/components/common/Badge.js';
import { Button } from '@/components/common/Button.js';
import { ReviewActions } from '@/components/compliance/ReviewActions.js';
import { ExecutionRulesCard } from '@/components/compliance/ExecutionRulesCard.js';
import { ErrorBanner } from '@/components/common/ErrorBanner.js';
import { Skeleton } from '@/components/ui/skeleton.js';
import { EvidenceDrawer } from '@/components/compliance/EvidenceDrawer.js';
import { SourceCitationDrawer } from '@/components/compliance/SourceCitationDrawer.js';
import { AssessmentPanel } from '@/components/compliance/AssessmentPanel.js';
import {
  ArrowLeft,
  Check,
  X,
  Bot,
  AlertTriangle,
  FileWarning,
  Copy,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { deriveGroundingMatch } from '@/utils/grounding.js';

export const ComplianceReviewPage: React.FC = () => {
  const { id: bidId = '', itemId = '' } = useParams<{ id: string; itemId: string }>();

  // Scroll to top automatically when navigating to any compliance item
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [bidId, itemId]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedQuote, setCopiedQuote] = useState<boolean>(false);

  // Drawer states
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);
  const [isAssessmentPanelOpen, setIsAssessmentPanelOpen] = useState(false);

  const fetchItem = useCallback(() => getComplianceItem(bidId, itemId), [bidId, itemId]);
  const {
    data: item,
    isLoading,
    error,
    refetch,
    setData: setItem,
  } = useApi<ComplianceItem>(fetchItem, [bidId, itemId]);

  const handleReview = async (
    status: ComplianceItem['status'],
    notes?: string,
    expectedVersion?: number,
  ) => {
    if (!item) return;
    setActionError(null);
    setActionSuccess(null);

    // Optimistic UI update
    const previous = item;
    setItem((prev) =>
      prev
        ? {
            ...prev,
            status,
            reviewNotes: notes || prev.reviewNotes,
            version: prev.version + 1,
            reviewedAt: new Date().toISOString(),
          }
        : null,
    );

    const res = await reviewComplianceItem(bidId, itemId, {
      status,
      notes,
      expectedVersion: expectedVersion ?? item.version,
    });

    if (!res.ok) {
      setItem(previous);
      setActionError(res.error.message || 'Failed to update review status.');
    } else {
      setActionSuccess(`Review decision saved as ${status}.`);
      refetch();
    }
  };

  const handleCopyQuote = (quote: string) => {
    navigator.clipboard.writeText(quote);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col gap-6 py-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <ErrorBanner
          message={error?.message || 'Compliance requirement not found'}
          onRetry={refetch}
        />
        <div className="mt-4">
          <Link to={`/bids/${bidId}`} className="text-primary hover:underline text-sm font-medium">
            ← Return to Bid Dossier
          </Link>
        </div>
      </div>
    );
  }

  const grounding = deriveGroundingMatch(item);
  const confidenceScore =
    item.provenance?.confidenceScore ?? item.sourceCitation?.confidenceScore ?? 0;
  const confidencePct = Math.round(confidenceScore * 100);

  // Compute Review Trigger Reason
  const reviewTriggers: string[] = [];
  if (item.humanReviewRequired) {
    reviewTriggers.push(
      'Triggered by System: Mandatory human sign-off required for this clause category.',
    );
  }
  if (!grounding.isExactVerbatim) {
    reviewTriggers.push(
      `Incomplete Citation Anchors (${grounding.matchPct}%): Source document coordinates or verbatim text partially unverified.`,
    );
  } else if (confidenceScore < 0.8 && confidenceScore > 0) {
    reviewTriggers.push(
      `Extraction Model Flag (${confidencePct}%): Extraction model flagged potential text ambiguity.`,
    );
  }
  if (!item.companyEvidence || item.companyEvidence.status === 'MISSING') {
    reviewTriggers.push(
      'Evidence Gap: No verified company credential currently matches this requirement.',
    );
  } else if (item.companyEvidence.status === 'EXPIRED') {
    reviewTriggers.push(
      `Expired Evidence: Attached document expired on ${item.companyEvidence.expiryDate || 'unknown date'}.`,
    );
  }
  if (item.risk && (item.risk.level === 'HIGH' || item.risk.level === 'CRITICAL')) {
    reviewTriggers.push(`High Commercial/Legal Risk: ${item.risk.summary}`);
  }
  if (reviewTriggers.length === 0) {
    reviewTriggers.push(
      'Standard Verification: Human confirmation needed to lock compliance matrix.',
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. Back Navigation Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Link
            to={`/bids/${bidId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Bid Dossier
          </Link>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <span className="text-xs font-mono font-medium text-foreground uppercase tracking-wider">
            Human Review Adjudication
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground font-mono">Current Status:</span>
          <StatusBadge status={item.status} size="md" />
          {item.risk && <RiskBadge level={item.risk.level} size="sm" />}
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      {actionSuccess && (
        <div className="bg-muted/80 border border-border text-foreground px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-foreground" /> {actionSuccess}
          </span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-inherit hover:opacity-75 cursor-pointer bg-transparent border-0 p-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Review Stage Flow Progression Header */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between overflow-x-auto gap-3 text-xs text-muted-foreground font-mono">
        <span className="font-semibold text-primary">1. Requirement</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="font-semibold text-primary">2. Tender Evidence</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="font-semibold text-primary">3. Company Evidence</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="font-semibold text-primary">4. AI Assessment</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="font-semibold text-orange-600 dark:text-orange-400">
          5. Trigger Reason
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span className="font-bold text-foreground">6. Human Decision</span>
      </div>

      {/* ========================================================================= */}
      {/* 1. REQUIREMENT DEFINITION */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Stage 1 • {item.category} Compliance
            </span>
            <Badge variant={item.isMandatory ? 'danger' : 'neutral'} size="sm">
              {item.isMandatory ? 'Mandatory Requirement' : 'Optional / Desirable'}
            </Badge>
            {item.subCategory && (
              <Badge variant="neutral" size="sm">
                {item.subCategory}
              </Badge>
            )}
            {item.tenderClauseRef && (
              <span className="text-xs font-mono text-muted-foreground">
                Clause: {item.tenderClauseRef}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            ID: {item.id.slice(0, 8)} • Rev v{item.version}
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground leading-snug">
          {item.requirement}
        </h1>

        <p className="text-sm text-foreground/90 leading-relaxed">{item.description}</p>

        {/* Execution & Statutory Rules Pillbox if applicable */}
        {item.executionRules && (
          <div className="mt-2 pt-3 border-t border-border">
            <ExecutionRulesCard executionRules={item.executionRules} />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. TENDER EVIDENCE (GROUNDING ANCHOR) */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              Stage 2 • What does the tender say?
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              (Tender Source Grounding)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                grounding.matchPct >= 80
                  ? 'bg-muted text-foreground border border-border'
                  : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
              }`}
              title={grounding.citationNote}
            >
              {grounding.badgeLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCitationDrawerOpen(true)}
              className="text-xs gap-1"
            >
              Full Citation <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Provenance Document & Page Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap font-mono">
          <div>
            <strong className="text-foreground">Document:</strong>{' '}
            <span>
              {item.sourceCitation?.document ||
                item.provenance?.documentName ||
                'NIT Tender Document'}
            </span>
          </div>
          <div>
            <strong className="text-foreground">Page:</strong>{' '}
            <span className="text-primary font-semibold">
              p. {item.sourceCitation?.page ?? item.provenance?.pageNumber ?? 1}
            </span>
          </div>
          {(item.sourceCitation?.section || item.provenance?.sectionOrClause) && (
            <div>
              <strong className="text-foreground">Section / Clause:</strong>{' '}
              <span>{item.sourceCitation?.section || item.provenance?.sectionOrClause}</span>
            </div>
          )}
        </div>

        {/* Verbatim Quote Container */}
        <div className="bg-background border border-border border-l-4 border-l-primary rounded-r-lg p-4">
          <div className="flex justify-between items-start gap-4">
            <p className="font-mono text-xs sm:text-sm text-foreground/90 leading-relaxed italic m-0">
              "
              {item.provenance?.verbatimQuote ||
                item.sourceCitation?.verbatimQuote ||
                item.description}
              "
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                handleCopyQuote(
                  item.provenance?.verbatimQuote ||
                    item.sourceCitation?.verbatimQuote ||
                    item.description,
                )
              }
              className="shrink-0 text-xs gap-1"
            >
              {copiedQuote ? (
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedQuote ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COMPANY EVIDENCE (BIDDER DOSSIER) */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              Stage 3 • What company evidence exists?
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              (Company Capability Profile)
            </span>
          </div>

          {item.companyEvidence && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEvidenceDrawerOpen(true)}
              className="text-xs gap-1"
            >
              Inspect Evidence <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>

        {item.companyEvidence ? (
          <div className="bg-background border border-border rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {item.companyEvidence.title}
                </span>
                <Badge
                  variant={
                    item.companyEvidence.status === 'VERIFIED'
                      ? 'success'
                      : item.companyEvidence.status === 'EXPIRED'
                        ? 'danger'
                        : 'warning'
                  }
                  size="sm"
                >
                  {item.companyEvidence.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Doc Type:{' '}
                <strong className="text-foreground">{item.companyEvidence.docType}</strong>
              </span>
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap font-mono">
              {item.companyEvidence.udinNumber && (
                <div>
                  <strong className="text-foreground">UDIN:</strong>{' '}
                  <span className="text-primary font-semibold">
                    {item.companyEvidence.udinNumber}
                  </span>
                </div>
              )}
              {item.companyEvidence.expiryDate && (
                <div>
                  <strong className="text-foreground">Validity:</strong>{' '}
                  <span>{item.companyEvidence.expiryDate}</span>
                </div>
              )}
              {item.companyEvidence.documentName && (
                <div>
                  <strong className="text-foreground">File:</strong>{' '}
                  <span>{item.companyEvidence.documentName}</span>
                </div>
              )}
            </div>

            {item.companyEvidence.notes && (
              <div className="text-xs text-muted-foreground italic border-t border-dashed border-border pt-2">
                Note: {item.companyEvidence.notes}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-destructive/5 border border-dashed border-destructive/30 rounded-lg p-6 text-center">
            <div className="text-destructive font-semibold text-sm flex items-center justify-center gap-2 mb-1">
              <FileWarning className="w-4 h-4" /> No Matching Company Evidence Linked
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              The system could not find an uploaded credential matching this requirement in your
              Company Profile.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEvidenceDrawerOpen(true)}
              className="text-xs"
            >
              Browse Evidence Vault & Attach
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. AI PRE-ASSESSMENT (ADVISORY — NOT FINAL) */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border border-dashed rounded-xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-primary" /> Stage 4 • What did the AI conclude?
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
              Advisory Pre-Assessment
            </span>
          </div>

          {item.rationale && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAssessmentPanelOpen(true)}
              className="text-xs gap-1"
            >
              Full Comparison Breakdown <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>

        {item.rationale ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-background border border-border rounded-lg p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Tender Mandate (Normalized)
                </div>
                <div className="text-xs text-foreground font-medium">
                  {item.rationale.tenderRequirement}
                </div>
              </div>

              <div className="bg-background border border-border rounded-lg p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Company Capability (Found)
                </div>
                <div className="text-xs text-foreground font-medium">
                  {item.rationale.companyCapability || 'No matching credential found.'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg flex-wrap gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Evaluated Rule:</span>
                <strong className="text-foreground">{item.rationale.ruleApplied}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">AI Outcome:</span>
                <span
                  className={`font-bold ${
                    item.rationale.comparisonResult === 'MET'
                      ? 'text-foreground'
                      : item.rationale.comparisonResult === 'NOT_MET'
                        ? 'text-destructive'
                        : 'text-amber-500'
                  }`}
                >
                  {item.rationale.comparisonResult}
                </span>
                <span className="text-muted-foreground">
                  ({Math.round((item.rationale.confidenceScore || 0) * 100)}% confidence)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            AI comparison rationale is not available for this item. Standard rule parsing applies.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. WHY IS REVIEW REQUIRED? (TRIGGER & RATIONALE) */}
      {/* ========================================================================= */}
      <div className="bg-amber-500/5 border border-amber-500/20 border-l-4 border-l-amber-500 rounded-xl p-6 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Stage 5 • Why is human review required?
          </span>
        </div>

        <ul className="m-0 pl-5 flex flex-col gap-1.5">
          {reviewTriggers.map((trigger, idx) => (
            <li key={idx} className="text-xs text-foreground/90 leading-relaxed">
              {trigger}
            </li>
          ))}
        </ul>

        {item.reviewNotes && (
          <div className="mt-2 pt-2.5 border-t border-dashed border-amber-500/20 text-xs text-muted-foreground font-mono">
            <strong>Previous Reviewer Note:</strong> {item.reviewNotes}
            {item.reviewedBy && (
              <span>
                {' '}
                (by {item.reviewedBy} at {item.reviewedAt})
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. HUMAN DECISION CONSOLE */}
      {/* ========================================================================= */}
      <div className="bg-card border-2 border-primary rounded-xl p-6 shadow-md flex flex-col gap-5">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground m-0">
              Stage 6 • Human Decision Console
            </h3>
            <p className="text-xs text-muted-foreground m-0 mt-0.5">
              Select your binding verdict. The human decision overrides any AI pre-assessment and is
              committed to the immutable audit log.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">Active Status:</span>
            <StatusBadge status={item.status} size="md" />
          </div>
        </div>

        {/* 5 Distinct Intent Actions */}
        <ReviewActions
          currentStatus={item.status}
          onReview={handleReview}
          expectedVersion={item.version}
          layout="card"
        />
      </div>

      {/* Drawers */}
      <EvidenceDrawer
        evidence={item.companyEvidence}
        provenance={item.provenance}
        citation={item.sourceCitation}
        rationale={item.rationale}
        requirementTitle={item.requirement}
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
      />

      <SourceCitationDrawer
        citation={item.sourceCitation}
        provenance={item.provenance}
        requirementTitle={item.requirement}
        isOpen={isCitationDrawerOpen}
        onClose={() => setIsCitationDrawerOpen(false)}
      />

      <AssessmentPanel
        rationale={item.rationale}
        requirementTitle={item.requirement}
        isOpen={isAssessmentPanelOpen}
        onClose={() => setIsAssessmentPanelOpen(false)}
      />
    </div>
  );
};
