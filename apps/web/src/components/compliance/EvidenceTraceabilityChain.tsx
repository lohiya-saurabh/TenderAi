import React from 'react';
import { Badge } from '../common/Badge.js';
import { StatusBadge } from '../common/StatusBadge.js';
import type { ComplianceItem } from '../../api/compliance.js';
import { deriveGroundingMatch } from '../../utils/grounding.js';

export interface EvidenceTraceabilityChainProps {
  item: ComplianceItem;
  onInspectCitation?: () => void;
  onInspectEvidence?: () => void;
  onInspectAssessment?: () => void;
  compact?: boolean;
}

export const EvidenceTraceabilityChain: React.FC<EvidenceTraceabilityChainProps> = ({
  item,
  onInspectCitation,
  onInspectEvidence,
  onInspectAssessment,
  compact = false,
}) => {
  const tenderDoc = item.sourceCitation?.document || item.provenance?.documentName || 'NIT Document';
  const tenderPage = item.sourceCitation?.page || item.provenance?.pageNumber || 1;
  const tenderClause = item.sourceCitation?.section || item.provenance?.sectionOrClause || item.tenderClauseRef || 'Clause';

  const companyDoc = item.companyEvidence?.documentName || item.companyEvidence?.title;
  const udin = item.companyEvidence?.udinNumber;
  const evidenceStatus = item.companyEvidence?.status || (item.status === 'MISSING' ? 'MISSING' : 'VERIFIED');
  const expiryDate = item.companyEvidence?.expiryDate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
      {/* 4-Node Linear Chain Header Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fit, minmax(180px, 1fr))'
            : 'repeat(4, 1fr)',
          gap: '0.6rem',
          alignItems: 'stretch',
        }}
      >
        {/* Node 1: Tender Requirement */}
        <div
          onClick={onInspectCitation}
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderLeft: '3px solid var(--color-primary-500)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            cursor: onInspectCitation ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.35rem',
          }}
        >
          <div>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              1. Tender Mandate
            </span>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-surface-text)',
                lineHeight: 1.4,
                marginTop: '0.15rem',
              }}
            >
              {item.requirement}
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-primary-400)', fontFamily: 'var(--font-mono)' }}>
            {tenderDoc} (p. {tenderPage}, {tenderClause})
          </div>
        </div>

        {/* Node 2: Required Evidence Specification */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderLeft: '3px solid var(--color-surface-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.35rem',
          }}
        >
          <div>
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              2. Required Evidence
            </span>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', marginTop: '0.15rem' }}>
              {item.category} Credential
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Badge variant={item.isMandatory ? 'danger' : 'neutral'} size="sm">
              {item.isMandatory ? 'Mandatory' : 'Optional'}
            </Badge>
            {item.executionRules?.udinRequired && (
              <Badge variant="primary" size="sm">
                UDIN Required
              </Badge>
            )}
            {item.executionRules?.notarizationRequired && (
              <Badge variant="warning" size="sm">
                Notarized
              </Badge>
            )}
          </div>
        </div>

        {/* Node 3: Company Evidence Dossier */}
        <div
          onClick={onInspectEvidence}
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderLeft: `3px solid ${
              item.companyEvidence?.status === 'EXPIRED'
                ? 'var(--color-danger)'
                : item.companyEvidence
                  ? 'var(--color-success)'
                  : 'var(--color-warning)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            cursor: onInspectEvidence ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.35rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                3. Company Evidence
              </span>
              <StatusBadge status={evidenceStatus} size="sm" />
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: item.companyEvidence ? 'var(--color-surface-text)' : 'var(--color-warning)',
                marginTop: '0.15rem',
              }}
            >
              {companyDoc || 'No verified evidence attached'}
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {udin && <span>UDIN: <strong style={{ color: 'var(--color-primary-300)', fontFamily: 'var(--font-mono)' }}>{udin}</strong></span>}
            {expiryDate && <span>Exp: <strong>{expiryDate}</strong></span>}
          </div>
        </div>

        {/* Node 4: Assessment Verdict */}
        <div
          onClick={onInspectAssessment}
          style={{
            backgroundColor: 'var(--color-surface-card)',
            border: '1px solid var(--color-surface-border)',
            borderLeft: `3px solid ${
              item.status === 'PASS'
                ? 'var(--color-success)'
                : item.status === 'FAIL'
                  ? 'var(--color-danger)'
                  : 'var(--color-warning)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            cursor: onInspectAssessment ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.35rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                4. Assessment
              </span>
              <StatusBadge status={item.status} size="sm" />
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-text)', marginTop: '0.15rem' }}>
              {item.rationale?.ruleApplied || 'Automated Rule Comparison'}
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
            Grounding Score: <strong style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
              {deriveGroundingMatch(item).matchPct}%
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
