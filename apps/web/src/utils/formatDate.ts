/**
 * TenderPulse AI — Date Formatting Utilities
 *
 * Formats ISO 8601 date strings for the Indian locale (IST).
 */

/**
 * Format an ISO date string to a human-readable date.
 * Example: "2026-10-02T14:30:00Z" → "02 Oct 2026"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format an ISO date string to date + time.
 * Example: "2026-10-02T14:30:00Z" → "02 Oct 2026, 08:00 PM"
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format a relative time string.
 * Example: "5 minutes ago", "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return formatDate(isoString);
}
