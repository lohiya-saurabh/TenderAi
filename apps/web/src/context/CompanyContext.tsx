import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { listCompanies, type CompanyItem, createCompany as apiCreateCompany, type CreateCompanyInput } from '../api/companies.js';

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

const FALLBACK_COMPANIES: CompanyItem[] = [
  {
    id: 'comp_acme_infra_001',
    organizationId: 'org_acme_infra_001',
    legalName: 'Acme Infrastructure Solutions Ltd.',
    slug: 'acme-infra',
    gstin: '27AAKCA1234F1Z5',
    pan: 'AAKCA1234F',
    udyamId: 'UDYAM-MH-12-0049281',
    constitution: 'PUBLIC_LIMITED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'comp_acme_tech_002',
    organizationId: 'org_acme_infra_001',
    legalName: 'Acme Smart Systems & Surveillance Pvt Ltd',
    slug: 'acme-tech',
    gstin: '27AABCS4412Q1ZX',
    pan: 'AABCS4412Q',
    udyamId: 'UDYAM-MH-12-0088192',
    constitution: 'PRIVATE_LIMITED',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

function getFallbackCompanies(orgId?: string): CompanyItem[] {
  if (orgId === 'org_bharat_build_002') {
    return [
      {
        id: 'comp_bharat_heavy_001',
        organizationId: 'org_bharat_build_002',
        legalName: 'Bharat Heavy Infrastructure Enterprises Ltd',
        slug: 'bharat-heavy',
        gstin: '07AAACB2194P1Z8',
        pan: 'AAACB2194P',
        udyamId: 'UDYAM-DL-05-0012948',
        constitution: 'PUBLIC_LIMITED',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ];
  }
  return FALLBACK_COMPANIES;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'tenderpulse_active_company_';

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const orgId = user?.organizationId || 'org_acme_infra_001';
  const initialFallback = getFallbackCompanies(orgId);

  const [companies, setCompanies] = useState<CompanyItem[]>(initialFallback);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(initialFallback[0]?.id || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = user?.organizationId ? `${STORAGE_KEY_PREFIX}${user.organizationId}` : null;

  const reloadCompanies = useCallback(async () => {
    if (!isAuthenticated || !user) {
      const fallback = getFallbackCompanies();
      setCompanies(fallback);
      setSelectedCompanyIdState(fallback[0]?.id || null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listCompanies();
    setIsLoading(false);

    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      const fetched = result.data;
      setCompanies(fetched);

      // Determine active company
      const savedId = storageKey && typeof window !== 'undefined' && window.localStorage
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
      const fallback = getFallbackCompanies(user.organizationId);
      setCompanies(fallback);
      setSelectedCompanyIdState(fallback[0]?.id || null);
    }
  }, [isAuthenticated, user, storageKey]);

  useEffect(() => {
    reloadCompanies();
  }, [reloadCompanies]);

  const setSelectedCompanyId = useCallback((id: string) => {
    setSelectedCompanyIdState(id);
    if (storageKey && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, id);
    }
  }, [storageKey]);

  const handleCreateCompany = useCallback(async (input: CreateCompanyInput): Promise<CompanyItem | null> => {
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
  }, [orgId, reloadCompanies, setSelectedCompanyId]);

  const selectedCompany: CompanyItem | null = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) ?? (companies.length > 0 ? (companies[0] ?? null) : null);
  }, [companies, selectedCompanyId]);

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    selectedCompanyId: selectedCompany?.id ?? null,
    selectedCompany,
    isLoading,
    error,
    setSelectedCompanyId,
    reloadCompanies,
    createCompany: handleCreateCompany,
  }), [companies, selectedCompany, isLoading, error, setSelectedCompanyId, reloadCompanies, handleCreateCompany]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = (): CompanyContextValue => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
