import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.js';
import { TendersIcon, AlertCircleIcon } from '../common/Icons.js';
import type { PipelineStage } from './dashboardData.js';

export interface BidPipelineCardProps {
  stages: PipelineStage[];
  archivedCount: number;
  /** Currently selected status filter (shared with the Active Tenders tabs) */
  selectedStatus: string;
  /** Selecting a stage filters the Active Tenders table to that workflow status */
  onSelectStage: (status: string) => void;
}

/**
 * Bid Pipeline — live workflow stage distribution derived from
 * GET /api/v1/bids statuses. Selecting a stage filters Active Tenders.
 */
export const BidPipelineCard: React.FC<BidPipelineCardProps> = ({
  stages,
  archivedCount,
  selectedStatus,
  onSelectStage,
}) => {
  const totalActive = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card variant="default" padding="md">
      <CardHeader
        action={
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-surface-muted)',
            }}
          >
            {totalActive} active
          </span>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TendersIcon size={16} color="var(--color-primary-400)" />
          <CardTitle as="h3">Bid Pipeline</CardTitle>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-surface-muted)' }}>
          Workflow stage distribution — select a stage to filter the tender list
        </p>
      </CardHeader>

      <CardContent>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {stages.map((stage) => {
            const isSelected = selectedStatus === stage.status;
            const isEmpty = stage.count === 0;

            return (
              <button
                key={stage.status}
                type="button"
                onClick={() => onSelectStage(stage.status)}
                aria-pressed={isSelected}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '0.35rem',
                  padding: '0.85rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected
                    ? 'var(--color-surface-card-hover)'
                    : 'var(--color-surface-card-subtle)',
                  border: isSelected
                    ? '1px solid var(--color-primary-500)'
                    : '1px solid var(--color-surface-border)',
                  borderLeft: isSelected
                    ? '3px solid var(--color-primary-500)'
                    : '1px solid var(--color-surface-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  opacity: isEmpty ? 0.55 : 1,
                  transition: 'all var(--transition-fast)',
                  fontFamily: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      color: 'var(--color-surface-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 700,
                      color: 'var(--color-surface-text)',
                      lineHeight: 1,
                    }}
                  >
                    {stage.count}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: 'var(--text-2xs)',
                    color: 'var(--color-surface-subtle)',
                    lineHeight: 1.3,
                  }}
                >
                  {stage.description}
                </span>

                {/* Stage signals: readiness + flagged counts */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.15rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {stage.readinessPct !== null ? (
                    <span
                      style={{
                        fontSize: 'var(--text-2xs)',
                        fontWeight: 600,
                        color:
                          stage.readinessPct >= 80
                            ? 'var(--color-success)'
                            : 'var(--color-surface-text)',
                      }}
                    >
                      {stage.readinessPct}% ready
                    </span>
                  ) : (
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-surface-subtle)' }}>
                      No requirements yet
                    </span>
                  )}
                  {stage.flaggedRequirements > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: 'var(--text-2xs)',
                        fontWeight: 600,
                        color: 'var(--color-danger)',
                      }}
                    >
                      <AlertCircleIcon size={11} color="var(--color-danger)" />
                      {stage.flaggedRequirements} flagged
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {archivedCount > 0 && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-2xs)',
              color: 'var(--color-surface-subtle)',
            }}
          >
            {archivedCount} archived tender{archivedCount === 1 ? '' : 's'} excluded from the pipeline
          </div>
        )}
      </CardContent>
    </Card>
  );
};
