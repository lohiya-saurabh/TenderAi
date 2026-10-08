import { describe, it, expect } from 'vitest';
import { computeReadiness, computeRiskLevel } from '../readiness.js';

describe('readiness — Invariant Guarantees', () => {
  it('strictly caps readiness percentage at 100% even if approved exceeds total', () => {
    // Simulating desynchronized or corrupt counter: 13 approved out of 9 total
    const result = computeReadiness({
      totalRequirements: 9,
      approvedRequirements: 13,
      flaggedRequirements: 1,
    });

    expect(result.total).toBe(9);
    // Approved count must be capped to total
    expect(result.approved).toBe(9);
    // Percentage must be capped to 100% (never 144%)
    expect(result.pct).toBe(100);
  });

  it('returns null percentage when totalRequirements is 0', () => {
    const result = computeReadiness({
      totalRequirements: 0,
      approvedRequirements: 0,
      flaggedRequirements: 0,
    });

    expect(result.pct).toBeNull();
  });

  it('correctly calculates normal progress percentage', () => {
    const result = computeReadiness({
      totalRequirements: 10,
      approvedRequirements: 7,
      flaggedRequirements: 2,
    });

    expect(result.approved).toBe(7);
    expect(result.pct).toBe(70);
  });

  it('computes risk levels based on flagged thresholds', () => {
    expect(computeRiskLevel({ flaggedRequirements: 0 })).toBe('LOW');
    expect(computeRiskLevel({ flaggedRequirements: 1 })).toBe('HIGH');
    expect(computeRiskLevel({ flaggedRequirements: 3 })).toBe('CRITICAL');
  });
});
