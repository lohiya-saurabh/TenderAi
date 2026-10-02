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
