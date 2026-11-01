import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ACRONYMS = /\b(ai|id|pdf|url|emd|gst|gstin|pan|cin|msme|udin|iso|boq|nit|oem|ca|pbg|ld)\b/gi;

/** "REVIEW_READY" / "clauseReviewed" → "Review ready": enum and event names as sentence-case words. */
export function enumLabel(value: string): string {
  const w = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim()
    .toLowerCase();
  return (w.charAt(0).toUpperCase() + w.slice(1)).replace(ACRONYMS, (m) => m.toUpperCase());
}
