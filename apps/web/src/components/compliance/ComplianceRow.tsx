import React, { useState } from 'react';
import type { ComplianceItem } from '../../api/compliance.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { RiskBadge } from '../common/RiskBadge.js';
import { Badge, type BadgeVariant } from '../common/Badge.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';
import { ChevronRightIcon, ChevronDownIcon } from '../common/Icons.js';
import { ExecutionRulesCard } from './ExecutionRulesCard.js';
import { ReviewActions } from './ReviewActions.js';
import { EvidenceTraceabilityChain } from './EvidenceTraceabilityChain.js';

export interface ComplianceRowProps {
  item: ComplianceItem;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onReview: (itemId: string, status: ComplianceItem['status'], notes?: string, expectedVersion?: number) => Promise<void>;
  onInspectEvidence?: (item: ComplianceItem) => void;
  onInspectCitation?: (item: ComplianceItem) => void;
  onInspectAssessment?: (item: ComplianceItem) => void;
}

export const ComplianceRow: React.FC<ComplianceRowProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  onReview,
  onInspectEvidence,
  onInspectCitation,
  onInspectAssessment,
}) => {
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const handleRowReview = async (status: ComplianceItem['status'], notes?: string) => {
    setIsReviewing(true);
    try {
      await onReview(item.id, status, notes, item.version);
    } finally {
      setIsReviewing(false);
    }
  };

  const riskLevel = item.risk?.level || 'LOW';

  const sourceDocName = item.sourceCitation?.document || item.provenance?.documentName || 'NIT';
  const sourcePage = item.sourceCitation?.page || item.provenance?.pageNumber || 1;

  const categoryVariant = getCategoryBadgeVariant(item.category);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-card)',
        border: `1px solid ${isExpanded ? 'var(--color-primary-500)' : 'var(--color-surface-border)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'all var(--transition-fast)',
        boxShadow: isExpanded ? 'var(--shadow-md)' : 'none',
      }}
    >
      {/* Main 7-Column Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '30% 11% 8% 18% 13% 10% 10%',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
          borderBottom: isExpanded ? '1px solid var(--color-surface-border)' : 'none',
          userSelect: 'none',
        }}
        onClick={() => onToggleExpand(item.id)}
      >
        {/* 1. Requirement */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-surface-muted)',
              flexShrink: 0,
            }}
            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          >
            {isExpanded ? (
              <ChevronDownIcon size={16} color="var(--color-primary-400)" />
            ) : (
              <ChevronRightIcon size={16} />
            )}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={item.requirement}
            >
              {item.requirement}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
              {item.tenderClauseRef && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-primary-400)',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    padding: '0.05rem 0.35rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Clause {item.tenderClauseRef}
                </span>
              )}
              {item.subCategory && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--color-surface-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.subCategory}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Category */}
        <div>
          <Badge variant={categoryVariant} size="sm">
            {item.category}
          </Badge>
        </div>

        {/* 3. Mandatory */}
        <div>
          {item.isMandatory ? (
            <Badge variant="danger" size="sm">
              Mandatory
            </Badge>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-subtle)', fontWeight: 500 }}>
              Optional
            </span>
          )}
        </div>

        {/* 4. Company Evidence */}
        <div style={{ minWidth: 0 }}>
          {item.companyEvidence ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                minWidth: 0,
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onInspectEvidence?.(item);
              }}
              title="Click to inspect linked company evidence"
            >
              <StatusBadge status={item.companyEvidence.status} size="sm" showIcon={false} />
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-surface-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--color-surface-border)',
                }}
              >
                {item.companyEvidence.title}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-subtle)', fontStyle: 'italic' }}>
              No evidence linked
            </span>
          )}
        </div>

        {/* 5. Status */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusBadge status={item.status} size="sm" />
        </div>

        {/* 6. Risk */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <RiskBadge level={riskLevel} size="sm" />
        </div>

        {/* 7. Source */}
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspectCitation?.(item);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.5rem',
              backgroundColor: 'var(--color-surface-bg)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              color: 'var(--color-surface-muted)',
              cursor: 'pointer',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)',
            }}
            title="Inspect source clause citation"
          >
            <span>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              p.{sourcePage}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded Detail Panel — Answers the 4 Core Questions */}
      {isExpanded && (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-surface-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            borderTop: '1px solid var(--color-surface-border)',
          }}
        >
          {/* Dual-Sided Evidence Traceability Chain */}
          <EvidenceTraceabilityChain
            item={item}
            onInspectCitation={() => onInspectCitation?.(item)}
            onInspectEvidence={() => onInspectEvidence?.(item)}
            onInspectAssessment={() => onInspectAssessment?.(item)}
          />

          {/* Question 1: What does the tender require? */}
          <Card padding="md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                1. What does the tender require?
              </h5>
              {item.isMandatory && <Badge variant="danger" size="sm">Mandatory Qualification Criterion</Badge>}
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
              {item.requirement}
            </p>

            {/* Execution / Statutory Rules Card */}
            {item.executionRules && (
              <ExecutionRulesCard executionRules={item.executionRules} />
            )}
          </Card>

          {/* Grid for Questions 2, 3, and 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Question 2: Do we have evidence? */}
            <Card padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  2. Do we have evidence?
                </h5>
                {item.companyEvidence && (
                  <StatusBadge status={item.companyEvidence.status} size="sm" />
                )}
              </div>

              {item.companyEvidence ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>
                    {item.companyEvidence.title}
                  </div>
                  <div style={{ color: 'var(--color-surface-muted)' }}>
                    Type: <span style={{ color: 'var(--color-surface-text)' }}>{item.companyEvidence.docType}</span>
                    {item.companyEvidence.udinNumber && (
                      <span> • UDIN: <code style={{ color: 'var(--color-primary-400)' }}>{item.companyEvidence.udinNumber}</code></span>
                    )}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onInspectEvidence?.(item)}
                    >
                      Inspect Evidence Details
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span>No company evidence attached to satisfy this clause.</span>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onInspectEvidence?.(item)}
                    >
                      Map / Upload Evidence
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Question 3: Why did the system reach this result? */}
            <Card padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  3. Why did the system reach this result?
                </h5>
                <StatusBadge status={item.status} size="sm" />
              </div>

              {item.rationale ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                  <div style={{ color: 'var(--color-surface-text)', lineHeight: 1.5 }}>
                    <strong>Rule:</strong> {item.rationale.ruleApplied}
                  </div>
                  <div style={{ color: 'var(--color-surface-muted)' }}>
                    Confidence: <span style={{ fontWeight: 600, color: 'var(--color-surface-text)' }}>{Math.round((item.rationale.confidenceScore || 0) * 100)}%</span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onInspectAssessment?.(item)}
                    >
                      View Full Rationale Breakdown
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span>Automated rationale not computed yet.</span>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onInspectAssessment?.(item)}
                    >
                      Inspect Assessment
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Question 4: Where did this requirement come from? */}
            <Card padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  4. Where did this come from?
                </h5>
                <Badge variant="neutral" size="sm">
                  Page {sourcePage}
                </Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                <div style={{ color: 'var(--color-surface-text)', fontWeight: 500 }}>
                  {sourceDocName} {item.sourceCitation?.section ? `• ${item.sourceCitation.section}` : ''}
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-bg)',
                    borderLeft: '2px solid var(--color-primary-500)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                    fontStyle: 'italic',
                    color: 'var(--color-surface-muted)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  "{item.sourceCitation?.verbatimQuote || item.provenance?.verbatimQuote || 'Verbatim quote available in citation drawer.'}"
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onInspectCitation?.(item)}
                  >
                    View Source Citation & Quote
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Review Notes Section */}
          {item.reviewNotes && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px solid var(--color-surface-border)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ color: 'var(--color-surface-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
                Reviewer Justification:
              </div>
              <div style={{ color: 'var(--color-surface-text)', lineHeight: 1.5 }}>{item.reviewNotes}</div>
            </div>
          )}

          {/* Footer with Human Review Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-surface-border)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
              Version {item.version} • {item.reviewedAt ? `Reviewed on ${item.reviewedAt}` : 'Pending Human Review'}
              {item.humanReviewRequired && (
                <span style={{ marginLeft: '0.5rem' }}>
                  <Badge variant="warning" size="sm">Human Review Required</Badge>
                </span>
              )}
            </div>

            <ReviewActions
              currentStatus={item.status}
              onReview={handleRowReview}
              isLoading={isReviewing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

function getCategoryBadgeVariant(category: ComplianceItem['category']): BadgeVariant {
  switch (category) {
    case 'LEGAL':
      return 'primary';
    case 'TECHNICAL':
      return 'neutral';
    case 'FINANCIAL':
      return 'success';
    case 'STATUTORY':
      return 'warning';
    case 'EXECUTION':
      return 'danger';
    case 'COMMERCIAL':
      return 'neutral';
    default:
      return 'neutral';
  }
}