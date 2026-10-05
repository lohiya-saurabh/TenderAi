export const colors = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  status: {
    pending: '#f59e0b', // Amber
    ready: '#10b981', // Emerald
    flagged: '#ef4444', // Red
    waived: '#6b7280', // Slate
    pass: '#10b981',
    fail: '#ef4444',
    missing: '#f59e0b',
    reviewRequired: '#8b5cf6',
    notApplicable: '#64748b',
  },
  risk: {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#10b981',
  },
  surface: {
    bg: '#0f172a', // Dark slate
    card: '#1e293b',
    cardHover: '#253449',
    cardSubtle: '#172033',
    border: '#334155',
    borderLight: '#475569',
    text: '#f8fafc',
    muted: '#94a3b8',
    subtle: '#64748b',
    input: '#0f172a',
  },
  semantic: {
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  },
};

export const typography = {
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
  fontSize: {
    '2xs': '0.65rem',
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

export const spacing = {
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
};

export const radius = {
  none: '0',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
};

export const shadows = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
  glow: '0 0 20px rgba(99, 102, 241, 0.15)',
};

export type SemanticStatusType = 'PASS' | 'FAIL' | 'MISSING' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';

export const semanticStatusTokens: Record<
  SemanticStatusType,
  { label: string; bg: string; color: string; border: string; iconColor: string }
> = {
  PASS: {
    label: 'Pass',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    border: 'rgba(16, 185, 129, 0.3)',
    iconColor: '#34d399',
  },
  FAIL: {
    label: 'Fail',
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
    iconColor: '#f87171',
  },
  MISSING: {
    label: 'Missing',
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.3)',
    iconColor: '#fbbf24',
  },
  REVIEW_REQUIRED: {
    label: 'Review Required',
    bg: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    border: 'rgba(139, 92, 246, 0.35)',
    iconColor: '#c4b5fd',
  },
  NOT_APPLICABLE: {
    label: 'Not Applicable',
    bg: 'rgba(100, 116, 139, 0.12)',
    color: '#94a3b8',
    border: 'rgba(100, 116, 139, 0.3)',
    iconColor: '#64748b',
  },
};

export type RiskLevelType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const riskLevelTokens: Record<
  RiskLevelType,
  { label: string; bg: string; color: string; border: string; accent: string }
> = {
  CRITICAL: {
    label: 'Critical Risk',
    bg: 'rgba(220, 38, 38, 0.15)',
    color: '#f87171',
    border: 'rgba(220, 38, 38, 0.4)',
    accent: '#dc2626',
  },
  HIGH: {
    label: 'High Risk',
    bg: 'rgba(249, 115, 22, 0.15)',
    color: '#fb923c',
    border: 'rgba(249, 115, 22, 0.35)',
    accent: '#ea580c',
  },
  MEDIUM: {
    label: 'Medium Risk',
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.35)',
    accent: '#d97706',
  },
  LOW: {
    label: 'Low Risk',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.3)',
    accent: '#059669',
  },
};
