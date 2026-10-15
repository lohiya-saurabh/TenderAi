import { useAuth } from '@/auth/useAuth.js';

/**
 * Hook to check if current user has a specific permission (for UX conditional rendering).
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
