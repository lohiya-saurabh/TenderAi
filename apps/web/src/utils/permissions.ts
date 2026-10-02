/**
 * TenderPulse AI — Permission Constants & Helpers
 *
 * Mirrors the backend RBAC permission matrix from SECURITY_MODEL.md.
 * These are used for UX gating ONLY — backend enforces authorization.
 */

/** All known permissions in the system */
export const PERMISSIONS = {
  ORG_MANAGE: 'org:manage',
  ORG_USERS_MANAGE: 'org:users:manage',
  BIDS_CREATE: 'bids:create',
  BIDS_READ: 'bids:read',
  BIDS_UPDATE: 'bids:update',
  BIDS_DELETE: 'bids:delete',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_READ: 'documents:read',
  COMPLIANCE_REVIEW: 'compliance:review',
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Role → Permissions mapping for client-side UX gating */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_USERS_MANAGE,
    PERMISSIONS.BIDS_CREATE,
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.BIDS_UPDATE,
    PERMISSIONS.BIDS_DELETE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.COMPLIANCE_REVIEW,
    PERMISSIONS.AUDIT_READ,
  ],
  BID_MANAGER: [
    PERMISSIONS.BIDS_CREATE,
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.BIDS_UPDATE,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.COMPLIANCE_REVIEW,
    PERMISSIONS.AUDIT_READ,
  ],
  REVIEWER: [
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.COMPLIANCE_REVIEW,
    PERMISSIONS.AUDIT_READ,
  ],
  VIEWER: [
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.DOCUMENTS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
};

/**
 * Get permissions for a role. Returns empty array for unknown roles.
 * Used to derive client-side permissions when the JWT doesn't carry them explicitly.
 */
export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a set of permissions includes a specific permission.
 */
export function hasPermission(
  userPermissions: string[],
  required: Permission,
): boolean {
  return userPermissions.includes(required);
}
