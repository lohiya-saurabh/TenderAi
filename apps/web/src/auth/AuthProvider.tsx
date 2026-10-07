import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext.js';
import { login as apiLogin, register as apiRegister, logout as apiLogout, refreshTokens, type AuthUser, type RegisterRequest } from '../api/auth.js';
import { setTokens, setOnAuthExpired } from '../api/client.js';

interface AuthProviderProps {
  children: React.ReactNode;
}

const USER_STORAGE_KEY = 'tp_user_profile';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Logout callback
  const handleLogout = useCallback(() => {
    apiLogout();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  // Listen for API 401 unrecoverable expiration
  useEffect(() => {
    setOnAuthExpired(handleLogout);
  }, [handleLogout]);

  // Initial silent refresh attempt on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedRefreshToken = localStorage.getItem('tp_refresh_token');
      if (!storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await refreshTokens(storedRefreshToken);
        if (result.ok) {
          setTokens(result.data.accessToken, result.data.refreshToken);
        } else {
          handleLogout();
        }
      } catch {
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [handleLogout]);

  // Login handler
  const handleLogin = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiLogin(email, password);
        if (!result.ok) {
          return { success: false, error: result.error.message };
        }

        setTokens(result.data.accessToken, result.data.refreshToken);
        setUser(result.data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.data.user));

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Login failed unexpectedly',
        };
      }
    },
    [],
  );

  // Registration handler
  const handleRegister = useCallback(
    async (data: RegisterRequest): Promise<{ success: boolean; error?: string; companyId?: string }> => {
      try {
        const result = await apiRegister(data);
        if (!result.ok) {
          return { success: false, error: result.error.message };
        }

        setTokens(result.data.accessToken, result.data.refreshToken);
        setUser(result.data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.data.user));

        return {
          success: true,
          companyId: result.data.company?.id,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Registration failed unexpectedly',
        };
      }
    },
    [],
  );

  // RBAC Permission checkers (for UX rendering only)
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission) || user.permissions.includes('*');
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      if (user.permissions.includes('*')) return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user],
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      if (user.permissions.includes('*')) return true;
      return permissions.every((p) => user.permissions.includes(p));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [user, isLoading, handleLogin, handleRegister, handleLogout, hasPermission, hasAnyPermission, hasAllPermissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
