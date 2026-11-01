import type { LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Resolves NestJS LogLevel array from a standard LOG_LEVEL environment string.
 *
 * Supports: 'error', 'warn', 'info' | 'log', 'debug', 'verbose' | 'trace'.
 * Default: ['error', 'warn', 'log'] (INFO level).
 */
export function resolveLogLevels(level?: string, configService?: ConfigService): LogLevel[] {
  const envLevel =
    configService?.get<string>('LOG_LEVEL') ?? new ConfigService().get<string>('LOG_LEVEL');
  const normalized = (level ?? envLevel ?? 'info').toLowerCase().trim();
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
