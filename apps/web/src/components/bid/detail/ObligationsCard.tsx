import React from 'react';
import { Link } from 'react-router-dom';
import type { ComplianceItem } from '../../../api/compliance.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../common/Card.js';
import { Badge } from '../../common/Badge.js';
import { StatusBadge } from '../../common/StatusBadge.js';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
} from '../../common/Icons.js';
import { formatCurrency } from '../../../utils/formatCurrency.js';
import {
  getObligationsSummary,
  getFlaggedItems,
  type ObligationsSummary,
} from './bidDetailData.js';

export interface ObligationsCardProps {
  items: ComplianceItem[];
}

/**
 * Risks & statutory obligations.
 *
 * Everything here is derived from REAL data:
 *   - Execution rules (stamp paper, notarization, UDIN,
 *     signing rank) aggregated from the requirement matrix
 *   - FLAGGED requirements — the real disqualification-risk
 *     signal (evidence missing or insufficient per review)
 *
 * The commercial risk-findings engine (timeline pressure,
 * working-capital lock-in, liquidated damages analysis) has
 * no backend API yet — documented in MissingDataCallout.
 */
export const ObligationsCard: React.FC<ObligationsCardProps> = ({ items }) => {
  const obligations = getObligationsSummary(items);
  const flagged = getFlaggedItems(items);

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          flagged.length > 0 ? (
            <Badge variant="danger" size="sm" dot>
              {flagged.length} Risk Signal{flagged.length === 1 ? '' : 's'}
            </Badge>
          ) : (
            <Badge variant="success" size="sm" dot>
              Clean
            </Badge>
          )
        }
      >
        <CardTitle as="h3">Risks & Statutory Obligations</CardTitle>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Execution rules extracted from the tender and flagged disqualification risks
        </p>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Statutory obligations */}
          <ObligationGrid summary={obligations} />

          {/* Flagged requirements — the real risk signal */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <AlertCircleIcon size={14} color={flagged.length > 0 ? 'var(--color-danger)' : 'var(--color-surface-subtle)'} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-surface-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Flagged Requirements (disqualification risk)
              </span>
            </div>

            {flagged.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-surface-card-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-surface-border)',
                }}
              >
                <span style={{ color: 'var(--color-success)', display: 'inline-flex' }}>
                  <CheckIcon size={16} />
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
                  No requirements flagged. Every extracted clause has sufficient evidence on record.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {flagged.map((item) => {
                  const title = (item as { title?: string }).title || item.requirement;
                  return (
                  <Link
                    key={item.id}
                    to={`/bids/${item.bidId}/compliance/${item.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-card-subtle)',
                      border: '1px solid var(--color-danger-border)',
                      textDecoration: 'none',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-subtle)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                      <span style={{ color: 'var(--color-danger)', display: 'inline-flex', flexShrink: 0 }}>
                        <AlertCircleIcon size={15} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-surface-text)' }}>
                          {title}
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-muted)' }}>
                          {item.category} — evidence missing or insufficient
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <StatusBadge status={item.status} size="sm" />
                      <ChevronRightIcon size={14} color="var(--color-surface-subtle)" />
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function ObligationGrid({ summary }: { summary: ObligationsSummary }) {
  const obligations = [
    {
      label: 'Stamp Paper',
      active: summary.stampPaperCount > 0,
      detail:
        summary.stampPaperCount === 0
          ? 'Not mandated'
          : `${summary.stampPaperCount} requirement${summary.stampPaperCount === 1 ? '' : 's'}` +
            (summary.maxStampDenominationInr
              ? ` — up to ${formatCurrency(summary.maxStampDenominationInr)}`
              : ' — denomination per state act'),
    },
    {
      label: 'Notarization',
      active: summary.notarizationCount > 0,
      detail:
        summary.notarizationCount === 0
          ? 'Not mandated'
          : `${summary.notarizationCount} requirement${summary.notarizationCount === 1 ? '' : 's'} — Public Notary / Oath Commissioner`,
    },
    {
      label: 'CA Certificate & UDIN',
      active: summary.udinCount > 0,
      detail:
        summary.udinCount === 0
          ? 'Not mandated'
          : `${summary.udinCount} requirement${summary.udinCount === 1 ? '' : 's'} — 18-digit UDIN mandatory`,
    },
    {
      label: 'Signing Authority',
      active: summary.signingAuthorityRanks.length > 0,
      detail:
        summary.signingAuthorityRanks.length === 0
          ? 'Authorized Representative'
          : summary.signingAuthorityRanks.join(', '),
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-3)',
      }}
    >
      {obligations.map((obligation) => (
        <div
          key={obligation.label}
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: obligation.active
              ? 'rgba(99, 102, 241, 0.08)'
              : 'var(--color-surface-card-subtle)',
            border: `1px solid ${obligation.active ? 'rgba(99, 102, 241, 0.25)' : 'var(--color-surface-border)'}`,
          }}
        >
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: obligation.active ? 'var(--color-primary-400)' : 'var(--color-surface-muted)', marginBottom: '0.25rem' }}>
            {obligation.label}
          </div>
          <div style={{ fontSize: 'var(--text-2xs)', color: obligation.active ? 'var(--color-surface-text)' : 'var(--color-surface-subtle)', lineHeight: 1.4 }}>
            {obligation.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
