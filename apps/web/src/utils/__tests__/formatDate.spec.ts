import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime } from '../formatDate.js';

describe('formatDate utilities', () => {
  const sampleIso = '2026-10-02T14:30:00.000Z';

  it('formats date into Indian locale representation', () => {
    const formatted = formatDate(sampleIso);
    expect(formatted).toContain('Oct');
    expect(formatted).toContain('2026');
  });

  it('formats datetime including hour and minute', () => {
    const formatted = formatDateTime(sampleIso);
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/pm|am/i);
  });

  it('formats relative time accurately', () => {
    const now = Date.now();
    const tenMinsAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    expect(formatRelativeTime(tenMinsAgo)).toBe('10m ago');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });
});
