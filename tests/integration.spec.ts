import { describe, it, expect } from 'vitest';
import { colors } from '@tenderpulse/ui';
import type { BidStatusType, ComplianceCategoryType } from '@tenderpulse/shared-types';

describe('Monorepo Cross-Package Contract Integration', () => {
  it('should verify shared design tokens and shared types are accessible', () => {
    expect(colors.status.ready).toBe('#10b981');
    expect(colors.status.flagged).toBe('#ef4444');

    const sampleStatus: BidStatusType = 'REVIEW_READY';
    const sampleCategory: ComplianceCategoryType = 'ANNEXURE_DECLARATION';

    expect(sampleStatus).toBe('REVIEW_READY');
    expect(sampleCategory).toBe('ANNEXURE_DECLARATION');
  });
});
