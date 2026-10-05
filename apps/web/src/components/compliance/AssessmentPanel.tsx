import React from 'react';
import { Drawer } from '../common/Drawer.js';
import { Button } from '../common/Button.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import type { AssessmentRationale } from '../../api/compliance.js';

export interface AssessmentPanelProps {
  rationale: AssessmentRationale | null;
  requirementTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AssessmentPanel: React.FC<AssessmentPanelProps> = ({
  rationale,
  requirementTitle,
  isOpen,
  onClose,
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="System Assessment Rationale"
      description={`Why the system reached this result for: ${requirementTitle}`}
      width="560px"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close Panel
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {rationale ? (
          <>
            {/* Comparison Result Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                backgroundColor: getComparisonBackground(rationale.comparisonResult),
                border: `1px solid ${getComparisonBorder(rationale.comparisonResult)}`,
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <StatusBadge
                  status={mapComparisonToStatus(rationale.comparisonResult)}
                  label={formatComparisonLabel(rationale.comparisonResult)}
                  size="md"
                />
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Confidence:</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>
                  {Math.round((rationale.confidenceScore || 0) * 100)}%
                </span>
              </div>
            </div>

            {/* Rule Applied */}
            <Card padding="md">
              <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)' as unknown as number, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                Evaluation Rule Applied
              </h5>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-surface-text)', lineHeight: 1.6, fontWeight: 500 }}>
                {rationale.ruleApplied}
              </div>
            </Card>

            {/* Side-by-Side Comparison: Tender Requirement vs Company Capability */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Tender Requirement Criteria
                  </span>
                  <Badge variant="warning" size="sm">Tender Scope</Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {rationale.tenderRequirement}
                </div>
              </div>

              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Company Capability / Evidence
                  </span>
                  <Badge variant="success" size="sm">Company Match</Badge>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {rationale.companyCapability}
                </div>
              </div>
            </div>

            {/* Detailed Evaluation Points */}
            {rationale.details && rationale.details.length > 0 && (
              <Card padding="md">
                <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)' as unknown as number, color: 'var(--color-surface-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
                  Step-by-Step Logic Breakdown
                </h5>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', lineHeight: 1.7 }}>
                  {rationale.details.map((detail, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem' }}>
                      {detail}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Trust & Transparency Note */}
            <Card padding="md" variant="subtle">
              <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)' as unknown as number, color: 'var(--color-surface-text)', margin: '0 0 0.5rem' }}>
                AI Assessment Trust Model
              </h5>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', lineHeight: 1.6, margin: 0 }}>
                Assessments are calculated via multi-criteria matching against company past performance, financial turnovers, and credentials. Human reviewers can override the status at any time with review notes.
              </p>
            </Card>
          </>
        ) : (
          <Card padding="lg" variant="subtle">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '0.75rem',
                padding: '1.5rem 0',
              }}
            >
              <div style={{ fontSize: 'var(--text-3xl)', opacity: 0.7 }}>🧠</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' as unknown as number, color: 'var(--color-surface-text)' }}>
                Assessment Rationale Not Generated
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)', maxWidth: '340px', lineHeight: 1.6, margin: 0 }}>
                This requirement has not undergone automated capability evaluation yet. Run bid analysis to generate the compliance rationale.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Drawer>
  );
};

function formatComparisonLabel(result: AssessmentRationale['comparisonResult']): string {
  switch (result) {
    case 'MET':
      return 'Requirement Met';
    case 'NOT_MET':
      return 'Requirement Not Met';
    case 'PARTIAL':
      return 'Partially Satisfied';
    case 'UNCLEAR':
      return 'Needs Human Review';
    default:
      return result;
  }
}

function mapComparisonToStatus(result: AssessmentRationale['comparisonResult']) {
  switch (result) {
    case 'MET':
      return 'PASS' as const;
    case 'NOT_MET':
      return 'FAIL' as const;
    case 'PARTIAL':
      return 'REVIEW_REQUIRED' as const;
    case 'UNCLEAR':
      return 'REVIEW_REQUIRED' as const;
    default:
      return 'MISSING' as const;
  }
}

function getComparisonBackground(result: AssessmentRationale['comparisonResult']): string {
  switch (result) {
    case 'MET':
      return 'rgba(16, 185, 129, 0.08)';
    case 'NOT_MET':
      return 'rgba(239, 68, 68, 0.08)';
    case 'PARTIAL':
    case 'UNCLEAR':
      return 'rgba(245, 158, 11, 0.08)';
    default:
      return 'var(--color-surface-bg)';
  }
}

function getComparisonBorder(result: AssessmentRationale['comparisonResult']): string {
  switch (result) {
    case 'MET':
      return 'rgba(16, 185, 129, 0.25)';
    case 'NOT_MET':
      return 'rgba(239, 68, 68, 0.25)';
    case 'PARTIAL':
    case 'UNCLEAR':
      return 'rgba(245, 158, 11, 0.25)';
    default:
      return 'var(--color-surface-border)';
  }
}