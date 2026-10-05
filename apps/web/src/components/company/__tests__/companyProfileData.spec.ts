import { describe, it, expect } from 'vitest';
import {
  computeProfileHealth,
  getDaysUntilExpiry,
  ENTERPRISE_COMPANY_PROFILE,
  type FullCompanyProfile,
} from '../companyProfileData.js';

describe('Company Profile Data & Derivations', () => {
  it('computes profile health accurately for complete enterprise profile', () => {
    const health = computeProfileHealth(ENTERPRISE_COMPANY_PROFILE);
    expect(health.totalItems).toBeGreaterThan(15);
    expect(health.verifiedCount).toBeGreaterThan(10);
    expect(health.healthScorePct).toBeGreaterThanOrEqual(75);
    expect(health.isBidReady).toBe(true);
  });

  it('handles empty profile gracefully', () => {
    const emptyProfile: FullCompanyProfile = {
      ...ENTERPRISE_COMPANY_PROFILE,
      registrations: [],
      certifications: [],
      turnoverRecords: [],
      solvencyRecords: [],
      pastExperience: [],
      projects: [],
      oemAuthorizations: [],
      employees: [],
      equipment: [],
      geographicCoverage: [],
      evidenceVault: [],
    };

    const health = computeProfileHealth(emptyProfile);
    expect(health.totalItems).toBe(0);
    expect(health.healthScorePct).toBe(0);
    expect(health.isBidReady).toBe(false);
  });

  it('marks isBidReady as false if company is blacklisted', () => {
    const blacklistedProfile: FullCompanyProfile = {
      ...ENTERPRISE_COMPANY_PROFILE,
      isBlacklisted: true,
    };

    const health = computeProfileHealth(blacklistedProfile);
    expect(health.isBidReady).toBe(false);
  });

  it('marks isBidReady as false if expired items exist', () => {
    const expiredProfile: FullCompanyProfile = {
      ...ENTERPRISE_COMPANY_PROFILE,
      registrations: [
        {
          ...ENTERPRISE_COMPANY_PROFILE.registrations[0],
          status: 'EXPIRED',
        },
      ],
    };

    const health = computeProfileHealth(expiredProfile);
    expect(health.expiredCount).toBeGreaterThan(0);
    expect(health.isBidReady).toBe(false);
  });

  it('calculates days until expiry correctly', () => {
    expect(getDaysUntilExpiry(null)).toBeNull();
    expect(getDaysUntilExpiry(undefined)).toBeNull();

    // Future date
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysUntilExpiry(futureDate);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(11);

    // Past date
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const pastDays = getDaysUntilExpiry(pastDate);
    expect(pastDays).toBeLessThanOrEqual(0);
  });

  it('verifies all 11 core sections exist in the production profile', () => {
    expect(ENTERPRISE_COMPANY_PROFILE.registrations.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.certifications.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.turnoverRecords.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.solvencyRecords.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.pastExperience.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.projects.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.oemAuthorizations.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.employees.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.equipment.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.geographicCoverage.length).toBeGreaterThan(0);
    expect(ENTERPRISE_COMPANY_PROFILE.evidenceVault.length).toBeGreaterThan(0);
  });
});
