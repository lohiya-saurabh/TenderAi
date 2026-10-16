import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from '@/context/ThemeContext.js';

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'dark',
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return ctx;
};
