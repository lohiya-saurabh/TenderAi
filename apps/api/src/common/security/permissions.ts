/**
 * Atomic RBAC Permissions and Role Mappings for TenderPulse AI
 */

export const Permissions = {
  // Organization management
  ORG_MANAGE: 'org:manage',
  ORG_USERS_MANAGE: 'org:users:manage',

  // Bids
  BIDS_CREATE: 'bids:create',
  BIDS_READ: 'bids:read',
  BIDS_UPDATE: 'bids:update',
  BIDS_DELETE: 'bids:delete',

  // Documents
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_READ: 'documents:read',

  // Compliance
  COMPLIANCE_REVIEW: 'compliance:review',
  COMPLIANCE_BULK_INGEST: 'compliance:bulk_ingest',

  // Company Capability Profile (org-level data; basis of bid decisions)
  COMPANY_PROFILE_MANAGE: 'company-profile:manage',

  // Audit
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export type UserRole = 'ADMIN' | 'BID_MANAGER' | 'REVIEWER' | 'VIEWER' | 'INTERNAL_WORKER';

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    Permissions.ORG_MANAGE,
    Permissions.ORG_USERS_MANAGE,
    Permissions.BIDS_CREATE,
    Permissions.BIDS_READ,
    Permissions.BIDS_UPDATE,
    Permissions.BIDS_DELETE,
    Permissions.DOCUMENTS_UPLOAD,
    Permissions.DOCUMENTS_READ,
    Permissions.COMPLIANCE_REVIEW,
    Permissions.COMPANY_PROFILE_MANAGE,
    Permissions.AUDIT_READ,
  ]),

  BID_MANAGER: new Set<Permission>([
    Permissions.BIDS_CREATE,
    Permissions.BIDS_READ,
    Permissions.BIDS_UPDATE,
    Permissions.DOCUMENTS_UPLOAD,
    Permissions.DOCUMENTS_READ,
    Permissions.COMPLIANCE_REVIEW,
    Permissions.AUDIT_READ,
  ]),

  REVIEWER: new Set<Permission>([
    Permissions.BIDS_READ,
    Permissions.DOCUMENTS_READ,
    Permissions.COMPLIANCE_REVIEW,
    Permissions.AUDIT_READ,
  ]),

  VIEWER: new Set<Permission>([
    Permissions.BIDS_READ,
    Permissions.DOCUMENTS_READ,
    Permissions.AUDIT_READ,
  ]),

  INTERNAL_WORKER: new Set<Permission>([Permissions.COMPLIANCE_BULK_INGEST]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.has(permission) : false;
}
