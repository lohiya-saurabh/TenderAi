import React, { useState } from 'react';
import { Drawer } from '@/components/common/Drawer.js';
import { Button } from '@/components/common/Button.js';
import { Badge } from '@/components/common/Badge.js';
import { Card } from '@/components/common/Card.js';
import { CopyIcon, CheckIcon } from '@/components/common/Icons.js';
import type { SourceCitation, Provenance } from '@/api/compliance.js';

export interface SourceCitationDrawerProps {
  citation: SourceCitation;
  provenance: Provenance;
  requirementTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SourceCitationDrawer: React.FC<SourceCitationDrawerProps> = ({
  citation,
  provenance,
  requirementTitle,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const confidencePercent = Math.round(
    ((citation?.confidenceScore ?? provenance?.confidenceScore) || 0) * 100,
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback or ignore
    }
  };

  const documentTitle = citation?.document || provenance?.documentName || 'NIT Tender Document';
  const pageNum = citation?.page || provenance?.pageNumber || 1;
  const sectionName = citation?.section || provenance?.sectionOrClause || 'Not specified';
  const quoteText = citation?.verbatimQuote || provenance?.verbatimQuote || '';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Source Citation & Grounding"
      description={`Requirement: ${requirementTitle}`}
      width="540px"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close Panel
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Grounding Confidence Score */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor:
              confidencePercent >= 85 ? 'var(--status-pass-bg)' : 'rgba(234, 88, 12, 0.08)',
            border: `1px solid ${confidencePercent >= 85 ? 'var(--status-pass-border)' : 'rgba(234, 88, 12, 0.25)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: confidencePercent >= 85 ? 'var(--status-pass-text)' : '#ea580c',
              }}
            >
              {confidencePercent}%
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-surface-text)',
                fontWeight: 500,
              }}
            >
              AI Grounding Confidence
            </span>
          </div>
          <Badge variant={confidencePercent >= 85 ? 'success' : 'warning'} size="sm">
            {confidencePercent >= 85 ? 'High Traceability' : 'Verify Clause'}
          </Badge>
        </div>

        {/* Source Coordinates */}
        <Card padding="md">
          <h5
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)' as unknown as number,
              color: 'var(--color-surface-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 0.75rem',
            }}
          >
            Tender Source Location
          </h5>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: '0.75rem 1rem',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span style={{ color: 'var(--color-surface-muted)' }}>Document:</span>
            <span
              style={{
                color: 'var(--color-surface-text)',
                fontWeight: 600,
                wordBreak: 'break-word',
              }}
            >
              {documentTitle}
            </span>

            <span style={{ color: 'var(--color-surface-muted)' }}>Page Number:</span>
            <span style={{ color: 'var(--color-surface-text)', fontFamily: 'var(--font-mono)' }}>
              Page {pageNum}
            </span>

            <span style={{ color: 'var(--color-surface-muted)' }}>Section / Clause:</span>
            <span
              style={{
                color: 'var(--color-primary-400)',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {sectionName}
            </span>

            {provenance.documentId && (
              <>
                <span style={{ color: 'var(--color-surface-muted)' }}>Doc Reference ID:</span>
                <span
                  style={{
                    color: 'var(--color-surface-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {provenance.documentId}
                </span>
              </>
            )}
          </div>
        </Card>

        {/* Verbatim Quote Card */}
        <Card padding="md">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <h5
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)' as unknown as number,
                color: 'var(--color-surface-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              Verbatim Tender Clause
            </h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(quoteText)}
              icon={
                copied ? (
                  <CheckIcon size={14} color="var(--color-success)" />
                ) : (
                  <CopyIcon size={14} />
                )
              }
            >
              {copied ? 'Copied' : 'Copy Text'}
            </Button>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-surface-bg)',
              borderLeft: '3px solid var(--color-primary-500)',
              padding: '1rem',
              borderRadius: '0 var(--radius-md) var(--radius-md) 0',
              fontStyle: 'italic',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.7,
              color: 'var(--color-surface-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            "{quoteText}"
          </div>
        </Card>

        {/* Grounding Explanation */}
        <Card padding="md" variant="subtle">
          <h5
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-semibold)' as unknown as number,
              color: 'var(--color-surface-text)',
              margin: '0 0 0.5rem',
            }}
          >
            Clause Traceability & Integrity
          </h5>
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            This verbatim quote is extracted directly from the parsed tender document. It provides
            mathematical citation integrity for legal review, qualification checklists, and pre-bid
            clarification letters.
          </p>
        </Card>
      </div>
    </Drawer>
  );
};
