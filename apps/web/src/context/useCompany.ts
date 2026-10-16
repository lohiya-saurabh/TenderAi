import { useContext } from 'react';
import { CompanyContext, type CompanyContextValue } from '@/context/CompanyContext.js';

export const useCompany = (): CompanyContextValue => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
