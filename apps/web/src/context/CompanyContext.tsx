import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth.js';
import {
  listCompanies,
  type CompanyItem,
  createCompany as apiCreateCompany,
  type CreateCompanyInput,
} from '@/api/companies.js';

export interface CompanyContextValue {
  companies: CompanyItem[];
  selectedCompanyId: string | null;
  selectedCompany: CompanyItem | null;
  isLoading: boolean;
  error: string | null;
  setSelectedCompanyId: (id: string) => void;
  reloadCompanies: () => Promise<void>;
  createCompany: (input: CreateCompanyInput) => Promise<CompanyItem | null>;
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'tenderpulse_active_company_';

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const orgId = user?.organizationId || '';

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = user?.organizationId ? `${STORAGE_KEY_PREFIX}${user.organizationId}` : null;

  const reloadCompanies = useCallback(async () => {
    // If auth state is initializing or silently refreshing, hold off on API calls
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !user) {
      setCompanies([]);
      setSelectedCompanyIdState(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listCompanies();
    setIsLoading(false);

    if (result.ok && Array.isArray(result.data)) {
      const fetched = result.data;
      setCompanies(fetched);

      // Determine active company
      const savedId =
        storageKey && typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(storageKey)
          : null;

      if (savedId && fetched.some((c) => c.id === savedId)) {
        setSelectedCompanyIdState(savedId);
      } else if (fetched.length > 0 && fetched[0]) {
        setSelectedCompanyIdState(fetched[0].id);
        if (storageKey && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, fetched[0].id);
        }
      } else {
        setSelectedCompanyIdState(null);
      }
    } else {
      setCompanies([]);
      setSelectedCompanyIdState(null);
    }
  }, [authLoading, isAuthenticated, user, storageKey]);

  useEffect(() => {
    if (!authLoading) {
      void reloadCompanies();
    }
  }, [reloadCompanies, authLoading]);

  const setSelectedCompanyId = useCallback(
    (id: string) => {
      setSelectedCompanyIdState(id);
      if (storageKey && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, id);
      }
    },
    [storageKey],
  );

  const handleCreateCompany = useCallback(
    async (input: CreateCompanyInput): Promise<CompanyItem | null> => {
      const result = await apiCreateCompany(input);
      if (result.ok && result.data) {
        await reloadCompanies();
        setSelectedCompanyId(result.data.id);
        return result.data;
      }
      // Local optimistic addition for smooth UI
      const optimistic: CompanyItem = {
        id: `comp_${Date.now()}`,
        organizationId: orgId,
        legalName: input.legalName,
        slug: input.slug ?? null,
        gstin: input.gstin ?? null,
        pan: input.pan ?? null,
        udyamId: input.udyamId ?? null,
        constitution: input.constitution ?? 'PRIVATE_LIMITED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCompanies((prev) => [optimistic, ...prev]);
      setSelectedCompanyId(optimistic.id);
      return optimistic;
    },
    [orgId, reloadCompanies, setSelectedCompanyId],
  );

  const selectedCompany: CompanyItem | null = useMemo(() => {
    return (
      companies.find((c) => c.id === selectedCompanyId) ??
      (companies.length > 0 ? (companies[0] ?? null) : null)
    );
  }, [companies, selectedCompanyId]);

  const value = useMemo<CompanyContextValue>(
    () => ({
      companies,
      selectedCompanyId: selectedCompany?.id ?? null,
      selectedCompany,
      isLoading,
      error,
      setSelectedCompanyId,
      reloadCompanies,
      createCompany: handleCreateCompany,
    }),
    [
      companies,
      selectedCompany,
      isLoading,
      error,
      setSelectedCompanyId,
      reloadCompanies,
      handleCreateCompany,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

