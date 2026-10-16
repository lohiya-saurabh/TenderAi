import { describe, it, expect } from 'vitest';
import { formatINR, formatIndianNumber, formatCurrency } from '@/utils/formatCurrency.js';

describe('formatCurrency utility', () => {
  it('formats rupees with ₹ symbol in Indian grouping system', () => {
    // Note: Intl formatting may use non-breaking spaces
    expect(formatINR(1000).replace(/\s/g, ' ')).toMatch(/₹\s?1,000/);
    expect(formatINR(100000).replace(/\s/g, ' ')).toMatch(/₹\s?1,00,000/);
    expect(formatINR(10000000).replace(/\s/g, ' ')).toMatch(/₹\s?1,00,00,000/);
    expect(formatINR(45000000).replace(/\s/g, ' ')).toMatch(/₹\s?4,50,00,000/);
  });

  it('formatCurrency is an alias to formatINR', () => {
    expect(formatCurrency(500000)).toEqual(formatINR(500000));
  });

  it('formats numbers in Indian numbering system without currency symbol', () => {
    expect(formatIndianNumber(100000)).toBe('1,00,000');
    expect(formatIndianNumber(10000000)).toBe('1,00,00,000');
    expect(formatIndianNumber(500)).toBe('500');
  });
});
