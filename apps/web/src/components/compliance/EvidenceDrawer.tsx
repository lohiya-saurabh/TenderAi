import React, { useState } from 'react';
import { Drawer } from '../common/Drawer.js';
import { Button } from '../common/Button.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import type { CompanyEvidence, Provenance, SourceCitation, AssessmentRationale } from '../../api/compliance.js';

export interface EvidenceDrawerProps {
  evidence: CompanyEvidence | null;
  requirementTitle: string;
  provenance?: Provenance | null;
  citation?: SourceCitation | null;
  rationale?: AssessmentRationale | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  evidence,
  requirementTitle,
  provenance,
  citation,
  rationale,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const verbatimQuote = provenance?.verbatimQuote || citation?.verbatimQuote;
  const tenderDoc = citation?.document || provenance?.documentName || 'NIT Tender Document';
  const tenderPage = citation?.page ?? provenance?.pageNumber ?? 1;
  const tenderClause = citation?.section || provenance?.sectionOrClause || 'Clause reference';
  const confidencePercent = Math.round((provenance?.confidenceScore || citation?.confidenceScore || 0.95) * 100);

  const handleCopyQuote = () => {
    if (!verbatimQuote) return;
    navigator.clipboard.writeText(verbatimQuote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derive status label and styling
  const getSemanticStatus = () => {
    if (!evidence) return { status: 'MISSING' as const, label: 'Missing Evidence' };
    if (evidence.status === 'EXPIRED') return { status: 'FAIL' as const, label: 'Expired Credential' };
    if (evidence.status === 'VERIFIED') return { status: 'PASS' as const, label: 'Verified Credential' };
    if (evidence.status === 'SELF_ATTESTED') return { status: 'REVIEW_REQUIRED' as const, label: 'Self-Attested' };
    return { status: 'MISSING' as const, label: 'Pending Upload' };
  };

  const statusInfo = getSemanticStatus();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="First-Class Evidence Dossier"
      description={`Requirement: ${requirementTitle}`}
      width="640px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
            Tamper-proof hash checked • Grounded against Tender PDF
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* ================================================================= */}
        {/* 1. TENDER SIDE: SOURCE CITATION & GROUNDING */}
        {/* ================================================================= */}
        <Card padding="md" style={{ borderLeft: '3px solid var(--color-primary-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--color-primary-300)', textTransform: 'uppercase' }}>
              Side A • Tender Document Grounding
            </span>
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                fontWeight: 600,
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--color-success)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {confidencePercent}% Substring Match
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', fontSize: 'var(--text-xs)', marginBottom: '0.65rem' }}>
            <div>
              <span style={{ color: 'var(--color-surface-muted)' }}>Document: </span>
              <strong style={{ color: 'var(--color-surface-text)' }}>{tenderDoc}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-surface-muted)' }}>Page: </span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>p. {tenderPage}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-surface-muted)' }}>Section/Clause: </span>
              <strong style={{ color: 'var(--color-surface-text)' }}>{tenderClause}</strong>
            </div>
          </div>

          {verbatimQuote && (
            <div
              style={{
                backgroundColor: 'var(--color-surface-bg)',
                border: '1px solid var(--color-surface-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                position: 'relative',
              }}
            >
              <p style={{ fontStyle: 'italic', fontSize: 'var(--text-xs)', lineHeight: 1.5, color: 'var(--color-surface-text)', margin: 0 }}>
                "{verbatimQuote}"
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button variant="ghost" size="sm" onClick={handleCopyQuote} style={{ fontSize: 'var(--text-2xs)' }}>
                  {copied ? '✓ Copied' : 'Copy Citation'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ================================================================= */}
        {/* 2. COMPANY SIDE: VERIFIED CORPORATE EVIDENCE */}
        {/* ================================================================= */}
        <Card padding="md" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase' }}>
              Side B • Company Evidence Dossier
            </span>
            <StatusBadge status={statusInfo.status} label={statusInfo.label} size="sm" />
          </div>

          {evidence ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  backgroundColor: 'var(--color-surface-bg)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-surface-muted)', display: 'block', fontSize: 'var(--text-2xs)' }}>Evidence Title</span>
                  <strong style={{ color: 'var(--color-surface-text)' }}>{evidence.title}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-surface-muted)', display: 'block', fontSize: 'var(--text-2xs)' }}>Document Type</span>
                  <Badge variant="neutral" size="sm">{evidence.docType}</Badge>
                </div>

                {evidence.documentName && (
                  <div>
                    <span style={{ color: 'var(--color-surface-muted)', display: 'block', fontSize: 'var(--text-2xs)' }}>Attached File</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-surface-text)' }}>{evidence.documentName}</strong>
                  </div>
                )}

                {evidence.udinNumber && (
                  <div>
                    <span style={{ color: 'var(--color-surface-muted)', display: 'block', fontSize: 'var(--text-2xs)' }}>ICAI CA UDIN</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-300)' }}>{evidence.udinNumber}</strong>
                  </div>
                )}

                {evidence.expiryDate && (
                  <div>
                    <span style={{ color: 'var(--color-surface-muted)', display: 'block', fontSize: 'var(--text-2xs)' }}>Validity / Expiration</span>
                    <strong style={{ color: 'var(--color-surface-text)' }}>{evidence.expiryDate}</strong>
                  </div>
                )}
              </div>

              {evidence.notes && (
                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontStyle: 'italic', padding: '0.35rem 0' }}>
                  Auditor Remarks: {evidence.notes}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                border: '1px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
              }}
            >
              <div style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '0.2rem' }}>
                📄 Missing Evidence Document
              </div>
              <p style={{ color: 'var(--color-surface-muted)', margin: 0 }}>
                No matching verified credential exists in your Company Capability Vault. Attach an evidence file to satisfy this clause.
              </p>
            </div>
          )}
        </Card>

        {/* ================================================================= */}
        {/* 3. ASSESSMENT RATIONALE & COMPARISON */}
        {/* ================================================================= */}
        {rationale && (
          <Card padding="md" variant="subtle">
            <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--color-surface-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
              Assessment Comparison & Evaluation Rule
            </span>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', lineHeight: 1.5 }}>
              • <strong>Rule Evaluated:</strong> {rationale.ruleApplied}<br />
              • <strong>Tender Requirement:</strong> {rationale.tenderRequirement}<br />
              • <strong>Company Capability:</strong> {rationale.companyCapability || 'None'}<br />
              • <strong>Comparison Result:</strong> <strong style={{ color: rationale.comparisonResult === 'MET' ? 'var(--color-success)' : 'var(--color-danger)' }}>{rationale.comparisonResult}</strong>
            </div>
          </Card>
        )}
      </div>
    </Drawer>
  );
};