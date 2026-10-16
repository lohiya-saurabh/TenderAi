import * as schema from '@/common/database/schema.js';

export interface DashboardMetricsResult {
  activePipelineCount: number;
  totalPipelineValueRupees: number;
  totalFlaggedRequirements: number;
  imminentDeadlinesCount: number;
  pipelineDistribution: Record<string, number>;
  totalTendersCount: number;
  updatedAt: string;
}

/**
 * Calculates pre-aggregated tenant KPIs and pipeline analytics.
 */
export function calculateDashboardMetrics(
  allBids: schema.Bid[],
  now = new Date(),
): DashboardMetricsResult {
  const activeBids = allBids.filter((b) => b.status !== 'ARCHIVED');

  const activePipelineCount = activeBids.length;
  const totalPipelineValueRupees = activeBids.reduce(
    (sum, b) => sum + (Number(b.estimatedValueRupees) || 0),
    0,
  );
  const totalFlaggedRequirements = activeBids.reduce(
    (sum, b) => sum + (Number(b.flaggedRequirements) || 0),
    0,
  );

  let imminentDeadlinesCount = 0;
  const pipelineDistribution: Record<string, number> = {
    DRAFT: 0,
    ANALYZING: 0,
    REVIEW_READY: 0,
    SUBMITTED: 0,
    ARCHIVED: 0,
  };

  for (const b of allBids) {
    if (b.status in pipelineDistribution) {
      pipelineDistribution[b.status] = (pipelineDistribution[b.status] ?? 0) + 1;
    }
    if (b.status !== 'ARCHIVED' && b.submissionDeadline) {
      const d = new Date(b.submissionDeadline);
      if (!Number.isNaN(d.getTime())) {
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days <= 7) {
          imminentDeadlinesCount += 1;
        }
      }
    }
  }

  return {
    activePipelineCount,
    totalPipelineValueRupees,
    totalFlaggedRequirements,
    imminentDeadlinesCount,
    pipelineDistribution,
    totalTendersCount: allBids.length,
    updatedAt: now.toISOString(),
  };
}
