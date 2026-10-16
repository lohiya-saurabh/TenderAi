import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@/common/security/permissions.js';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Decorator to require one or more atomic permissions on a route handler.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
