/**
 * TenderPulse AI — INR Currency Formatting
 *
 * Formats numbers in Indian numbering system (lakhs, crores)
 * using the built-in Intl.NumberFormat with en-IN locale.
 */

/**
 * Format a number as Indian Rupees with the ₹ symbol.
 * Examples:
 *   formatINR(1000000)   → "₹10,00,000"
 *   formatINR(45000000)  → "₹4,50,00,000"
 *   formatINR(500)       → "₹500"
 */
export function formatINR(amountRupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountRupees);
}

/** Alias for formatINR */
export const formatCurrency = formatINR;

/**
 * Format a number in the Indian system without currency symbol.
 * Example: formatIndianNumber(10000000) → "1,00,00,000"
 */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

/**
 * Format a number as compact Indian currency (e.g. "₹245.00 Cr", "₹50.00 L")
 * Designed for executive dashboard KPI metric cards to avoid text clipping.
 */
export function formatCompactINR(amountRupees: number | string | null | undefined): string {
  const num = Number(amountRupees);
  if (!num || isNaN(num) || num <= 0) return '₹0.00 Cr';

  if (num >= 10_000_000) {
    const crores = num / 10_000_000;
    return `₹${crores.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
  }
  if (num >= 100_000) {
    const lakhs = num / 100_000;
    return `₹${lakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  }
  return formatINR(num);
}
