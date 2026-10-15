import { describe, it, expect } from 'vitest';
import { formatFileSize } from '@/utils/formatFileSize.js';

describe('formatFileSize', () => {
  it('should handle zero or null/undefined gracefully', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(undefined)).toBe('0 B');
    expect(formatFileSize(-10)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(646306)).toBe('631.2 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatFileSize(4076585)).toBe('3.89 MB');
    expect(formatFileSize(26008694)).toBe('24.80 MB');
  });
});
