import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { TendersIcon, AlertCircleIcon } from '../common/Icons.js';
import type { PipelineStage } from './dashboardData.js';
import { cn } from '../../lib/utils.js';

export interface BidPipelineCardProps {
  stages: PipelineStage[];
  archivedCount: number;
  selectedStatus: string;
  onSelectStage: (status: string) => void;
}

export const BidPipelineCard: React.FC<BidPipelineCardProps> = ({
  stages,
  archivedCount,
  selectedStatus,
  onSelectStage,
}) => {
  const totalActive = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TendersIcon size={16} className="text-primary" />
            <CardTitle className="text-base font-semibold">Bid Pipeline</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workflow stage distribution — select a stage to filter the tender list
          </p>
        </div>
        <Badge variant="secondary" className="font-medium">
          {totalActive} active
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((stage) => {
            const isSelected = selectedStatus === stage.status;
            const isEmpty = stage.count === 0;

            return (
              <button
                key={stage.status}
                type="button"
                onClick={() => onSelectStage(stage.status)}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col items-stretch gap-1 p-3 rounded-lg border text-left transition-all font-inherit cursor-pointer',
                  isSelected
                    ? 'bg-accent text-accent-foreground border-primary shadow-xs ring-1 ring-primary/20'
                    : 'bg-card/60 border-border hover:bg-accent/40',
                  isEmpty && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {stage.label}
                  </span>
                  <span className="text-lg font-bold text-foreground leading-tight tabular-nums">
                    {stage.count}
                  </span>
                </div>

                <span className="text-[11px] text-muted-foreground leading-tight line-clamp-1">
                  {stage.description}
                </span>

                {/* Stage signals: readiness + flagged counts */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {stage.readinessPct !== null ? (
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        stage.readinessPct >= 80 ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {stage.readinessPct}% ready
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      No requirements yet
                    </span>
                  )}
                  {stage.flaggedRequirements > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                      <AlertCircleIcon size={11} className="text-destructive" />
                      {stage.flaggedRequirements} flagged
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {archivedCount > 0 && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            {archivedCount} archived tender{archivedCount === 1 ? '' : 's'} excluded from the pipeline
          </div>
        )}
      </CardContent>
    </Card>
  );
};
