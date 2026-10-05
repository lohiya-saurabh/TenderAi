import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComplianceItem, reviewComplianceItem, type ComplianceItem } from '../api/compliance.js';
import { useApi } from '../hooks/useApi.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { RiskBadge } from '../components/common/RiskBadge.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { ReviewActions } from '../components/compliance/ReviewActions.js';
import { ExecutionRulesCard } from '../components/compliance/ExecutionRulesCard.js';
import { ErrorBanner } from '../components/common/ErrorBanner.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import { EvidenceDrawer } from '../components/compliance/EvidenceDrawer.js';
import { SourceCitationDrawer } from '../components/compliance/SourceCitationDrawer.js';
import { AssessmentPanel } from '../components/compliance/AssessmentPanel.js';
import { ChevronLeftIcon } from '../components/common/Icons.js';

export const ComplianceReviewPage: React.FC = () => {
  const { id: bidId = '', itemId = '' } = useParams<{ id: string; itemId: string }>();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedQuote, setCopiedQuote] = useState<boolean>(false);

  // Drawer states
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);
  const [isAssessmentPanelOpen, setIsAssessmentPanelOpen] = useState(false);

  const fetchItem = useCallback(() => getComplianceItem(bidId, itemId), [bidId, itemId]);
  const { data: item, isLoading, error, refetch, setData: setItem } = useApi<ComplianceItem>(fetchItem, [bidId, itemId]);

  const handleReview = async (status: ComplianceItem['status'], notes?: string, expectedVersion?: number) => {
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
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
        <LoadingSkeleton height="40px" />
        <LoadingSkeleton height="180px" />
        <LoadingSkeleton height="220px" />
        <LoadingSkeleton height="200px" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 0' }}>
        <ErrorBanner message={error?.message || 'Compliance requirement not found'} onRetry={refetch} />
        <div style={{ marginTop: '1rem' }}>
          <Link to={`/bids/${bidId}`} style={{ color: 'var(--color-primary-400)', textDecoration: 'none' }}>
            ← Return to Bid Project
          </Link>
        </div>
      </div>
    );
  }

  const confidenceScore = item.provenance?.confidenceScore ?? item.sourceCitation?.confidenceScore ?? 0;
  const confidencePct = Math.round(confidenceScore * 100);

  // Compute Review Trigger Reason
  const reviewTriggers: string[] = [];
  if (item.humanReviewRequired) {
    reviewTriggers.push('Triggered by System: Mandatory human sign-off required for this clause category.');
  }
  if (confidenceScore < 0.8) {
    reviewTriggers.push(`Low Grounding Confidence (${confidencePct}%): Extraction model flagged potential text ambiguity.`);
  }
  if (!item.companyEvidence || item.companyEvidence.status === 'MISSING') {
    reviewTriggers.push('Evidence Gap: No verified company credential currently matches this requirement.');
  } else if (item.companyEvidence.status === 'EXPIRED') {
    reviewTriggers.push(`Expired Evidence: Attached document expired on ${item.companyEvidence.expiryDate || 'unknown date'}.`);
  }
  if (item.risk && (item.risk.level === 'HIGH' || item.risk.level === 'CRITICAL')) {
    reviewTriggers.push(`High Commercial/Legal Risk: ${item.risk.summary}`);
  }
  if (reviewTriggers.length === 0) {
    reviewTriggers.push('Standard Verification: Human confirmation needed to lock compliance matrix.');
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', padding: '1rem 0 3rem' }}>
      {/* Back Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={`/bids/${bidId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--color-surface-muted)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ChevronLeftIcon size={16} />
            Back to Bid Workspace
          </Link>
          <span style={{ color: 'var(--color-surface-subtle)' }}>/</span>
          <span style={{ color: 'var(--color-surface-text)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            Human Review Adjudication
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
            Current Status:
          </span>
          <StatusBadge status={item.status} size="md" />
          {item.risk && <RiskBadge level={item.risk.level} size="sm" />}
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✓ {actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Review Stage Flow Progression Header */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-bg)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflowX: 'auto',
          gap: '0.75rem',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-surface-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary-400)', fontWeight: 600 }}>
          <span>1. Requirement</span>
        </div>
        <span>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary-400)', fontWeight: 600 }}>
          <span>2. Tender Evidence</span>
        </div>
        <span>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary-400)', fontWeight: 600 }}>
          <span>3. Company Evidence</span>
        </div>
        <span>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary-400)', fontWeight: 600 }}>
          <span>4. AI Assessment</span>
        </div>
        <span>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)', fontWeight: 600 }}>
          <span>5. Trigger Reason</span>
        </div>
        <span>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success)', fontWeight: 700 }}>
          <span>6. Human Decision</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REQUIREMENT DEFINITION */}
      {/* ========================================================================= */}
      <Card padding="lg" style={{ borderLeft: '4px solid var(--color-primary-500)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--color-primary-300)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
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
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', fontFamily: 'var(--font-mono)' }}>
                Clause: {item.tenderClauseRef}
              </span>
            )}
          </div>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontFamily: 'var(--font-mono)' }}>
            ID: {item.id.slice(0, 8)} • Rev v{item.version}
          </span>
        </div>

        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0 0 0.75rem', lineHeight: 1.3 }}>
          {item.requirement}
        </h1>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', lineHeight: 1.6, margin: 0 }}>
          {item.description}
        </p>

        {/* Execution & Statutory Rules Pillbox if applicable */}
        {item.executionRules && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-surface-border)' }}>
            <ExecutionRulesCard executionRules={item.executionRules} />
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 2. TENDER EVIDENCE (GROUNDING ANCHOR) */}
      {/* ========================================================================= */}
      <Card padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)' }}>
              Stage 2 • What does the tender say?
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              (Tender Source Grounding)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: confidencePct >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: confidencePct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
                border: `1px solid ${confidencePct >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}
            >
              {confidencePct}% Grounding Match
            </span>
            <Button variant="ghost" size="sm" onClick={() => setIsCitationDrawerOpen(true)}>
              Full Citation ↗
            </Button>
          </div>
        </div>

        {/* Provenance Document & Page Metadata */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-surface-muted)',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>Document:</strong>{' '}
            <span style={{ color: 'var(--color-surface-text)' }}>
              {item.sourceCitation?.document || item.provenance?.documentName || 'NIT Tender Document'}
            </span>
          </div>
          <div>
            <strong>Page:</strong>{' '}
            <span style={{ color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
              p. {item.sourceCitation?.page ?? item.provenance?.pageNumber ?? 1}
            </span>
          </div>
          {(item.sourceCitation?.section || item.provenance?.sectionOrClause) && (
            <div>
              <strong>Section / Clause:</strong>{' '}
              <span style={{ color: 'var(--color-surface-text)' }}>
                {item.sourceCitation?.section || item.provenance?.sectionOrClause}
              </span>
            </div>
          )}
        </div>

        {/* Verbatim Quote Container */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-bg)',
            border: '1px solid var(--color-surface-border)',
            borderLeft: '4px solid var(--color-primary-500)',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            padding: '1rem 1.25rem',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <p
              style={{
                fontFamily: 'var(--font-serif, Georgia, serif)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                color: 'var(--color-surface-text)',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              "{item.provenance?.verbatimQuote || item.sourceCitation?.verbatimQuote || item.description}"
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                handleCopyQuote(
                  item.provenance?.verbatimQuote || item.sourceCitation?.verbatimQuote || item.description,
                )
              }
              style={{ flexShrink: 0, fontSize: 'var(--text-2xs)' }}
            >
              {copiedQuote ? '✓ Copied' : 'Copy Quote'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 3. COMPANY EVIDENCE (BIDDER DOSSIER) */}
      {/* ========================================================================= */}
      <Card padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-surface-text)' }}>
              Stage 3 • What company evidence exists?
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              (Company Capability Profile)
            </span>
          </div>

          {item.companyEvidence && (
            <Button variant="ghost" size="sm" onClick={() => setIsEvidenceDrawerOpen(true)}>
              Inspect Evidence ↗
            </Button>
          )}
        </div>

        {item.companyEvidence ? (
          <div
            style={{
              backgroundColor: 'var(--color-surface-bg)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
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
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
                Doc Type: <strong>{item.companyEvidence.docType}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', flexWrap: 'wrap' }}>
              {item.companyEvidence.udinNumber && (
                <div>
                  <strong>UDIN:</strong>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>
                    {item.companyEvidence.udinNumber}
                  </span>
                </div>
              )}
              {item.companyEvidence.expiryDate && (
                <div>
                  <strong>Validity / Expiry:</strong>{' '}
                  <span style={{ color: 'var(--color-surface-text)' }}>
                    {item.companyEvidence.expiryDate}
                  </span>
                </div>
              )}
              {item.companyEvidence.documentName && (
                <div>
                  <strong>File Name:</strong>{' '}
                  <span style={{ color: 'var(--color-surface-text)' }}>
                    {item.companyEvidence.documentName}
                  </span>
                </div>
              )}
            </div>

            {item.companyEvidence.notes && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', fontStyle: 'italic', borderTop: '1px dashed var(--color-surface-border)', paddingTop: '0.5rem' }}>
                Note: {item.companyEvidence.notes}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px dashed rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.25rem' }}>
              📄 No Matching Company Evidence Linked
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', margin: '0 0 0.75rem' }}>
              The system could not find an uploaded credential matching this requirement in your Company Profile.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEvidenceDrawerOpen(true)}
            >
              Browse Evidence Vault & Attach
            </Button>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 4. AI PRE-ASSESSMENT (ADVISORY — NOT FINAL) */}
      {/* ========================================================================= */}
      <Card
        padding="lg"
        style={{
          border: '1px dashed rgba(99, 102, 241, 0.4)',
          backgroundColor: 'rgba(99, 102, 241, 0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary-300)' }}>
              🧠 Stage 4 • What did the AI conclude?
            </span>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--color-primary-300)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              AI Recommendation (Advisory Only — Not Final)
            </span>
          </div>

          {item.rationale && (
            <Button variant="ghost" size="sm" onClick={() => setIsAssessmentPanelOpen(true)}>
              Full Comparison Breakdown ↗
            </Button>
          )}
        </div>

        {item.rationale ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Rule comparison block */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--color-surface-card)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                }}
              >
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Tender Mandate (Normalized)
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', fontWeight: 500 }}>
                  {item.rationale.tenderRequirement}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-surface-card)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                }}
              >
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--color-surface-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Company Capability (Found)
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', fontWeight: 500 }}>
                  {item.rationale.companyCapability || 'No matching credential found.'}
                </div>
              </div>
            </div>

            {/* AI Result & Rule Summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                backgroundColor: 'var(--color-surface-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-surface-border)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--color-surface-muted)' }}>Evaluated Rule:</span>
                <strong style={{ color: 'var(--color-surface-text)' }}>{item.rationale.ruleApplied}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--color-surface-muted)' }}>AI Proposed Outcome:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      item.rationale.comparisonResult === 'MET'
                        ? 'var(--color-success)'
                        : item.rationale.comparisonResult === 'NOT_MET'
                          ? 'var(--color-danger)'
                          : 'var(--color-warning)',
                  }}
                >
                  {item.rationale.comparisonResult}
                </span>
                <span style={{ color: 'var(--color-surface-muted)' }}>
                  ({Math.round((item.rationale.confidenceScore || 0) * 100)}% confidence)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
            AI comparison rationale is not available for this item. Standard rule parsing applies.
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 5. WHY IS REVIEW REQUIRED? (TRIGGER & RATIONALE) */}
      {/* ========================================================================= */}
      <Card
        padding="lg"
        style={{
          borderLeft: '4px solid var(--color-warning)',
          backgroundColor: 'rgba(245, 158, 11, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-warning)' }}>
            ⚠️ Stage 5 • Why is human review required?
          </span>
        </div>

        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {reviewTriggers.map((trigger, idx) => (
            <li key={idx} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', lineHeight: 1.5 }}>
              {trigger}
            </li>
          ))}
        </ul>

        {item.reviewNotes && (
          <div
            style={{
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed var(--color-surface-border)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
            }}
          >
            <strong>Previous Reviewer Note:</strong> {item.reviewNotes}
            {item.reviewedBy && <span> (by {item.reviewedBy} at {item.reviewedAt})</span>}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 6. HUMAN DECISION CONSOLE */}
      {/* ========================================================================= */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-card)',
          border: '2px solid var(--color-primary-500)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-surface-text)', margin: '0 0 0.25rem' }}>
              Stage 6 • Human Decision Console
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', margin: 0 }}>
              Select your binding verdict. The human decision overrides any AI pre-assessment.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              Active Status:
            </span>
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