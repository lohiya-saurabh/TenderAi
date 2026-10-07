import type { LogLevel } from '@nestjs/common';

/**
 * Resolves NestJS LogLevel array from a standard LOG_LEVEL environment string.
 *
 * Supports: 'error', 'warn', 'info' | 'log', 'debug', 'verbose' | 'trace'.
 * Default: ['error', 'warn', 'log'] (INFO level).
 */
export function resolveLogLevels(level?: string): LogLevel[] {
  const normalized = (level ?? process.env.LOG_LEVEL ?? 'info').toLowerCase().trim();
  switch (normalized) {
    case 'error':
      return ['error'];
    case 'warn':
      return ['error', 'warn'];
    case 'info':
    case 'log':
      return ['error', 'warn', 'log'];
    case 'debug':
      return ['error', 'warn', 'log', 'debug'];
    case 'verbose':
    case 'trace':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    default:
      return ['error', 'warn', 'log'];
  }
}
