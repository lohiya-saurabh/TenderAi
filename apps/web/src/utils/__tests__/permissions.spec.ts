import { describe, it, expect } from 'vitest';
import { PERMISSIONS, getPermissionsForRole, hasPermission } from '@/utils/permissions.js';

describe('permissions utility', () => {
  it('returns appropriate permissions for ADMIN role', () => {
    const adminPerms = getPermissionsForRole('ADMIN');
    expect(adminPerms).toContain(PERMISSIONS.ORG_MANAGE);
    expect(adminPerms).toContain(PERMISSIONS.BIDS_CREATE);
    expect(adminPerms).toContain(PERMISSIONS.COMPLIANCE_REVIEW);
  });

  it('returns appropriate permissions for BID_MANAGER role', () => {
    const managerPerms = getPermissionsForRole('BID_MANAGER');
    expect(managerPerms).not.toContain(PERMISSIONS.ORG_MANAGE);
    expect(managerPerms).toContain(PERMISSIONS.BIDS_CREATE);
    expect(managerPerms).toContain(PERMISSIONS.COMPLIANCE_REVIEW);
  });

  it('returns restricted permissions for VIEWER role', () => {
    const viewerPerms = getPermissionsForRole('VIEWER');
    expect(viewerPerms).toContain(PERMISSIONS.BIDS_READ);
    expect(viewerPerms).not.toContain(PERMISSIONS.BIDS_CREATE);
    expect(viewerPerms).not.toContain(PERMISSIONS.COMPLIANCE_REVIEW);
  });

  it('correctly checks whether permission is present', () => {
    const perms = ['bids:read', 'compliance:review'];
    expect(hasPermission(perms, PERMISSIONS.BIDS_READ)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.BIDS_CREATE)).toBe(false);
  });
});
