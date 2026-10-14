import { createContext } from 'react';
import type { AuthUser, RegisterRequest } from '../api/auth.js';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    data: RegisterRequest,
  ) => Promise<{ success: boolean; error?: string; companyId?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
