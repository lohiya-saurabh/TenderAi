import crypto from 'node:crypto';
import { UnauthorizedTenantAccessException } from '../domain/DomainException.js';

export class InternalServiceGuard {
  private readonly internalApiKey: string;

  constructor(
    internalApiKey = process.env['INTERNAL_SERVICE_KEY'] ?? 'tenderpulse-internal-secret-2026',
  ) {
    if (process.env['NODE_ENV'] === 'production' && !process.env['INTERNAL_SERVICE_KEY']) {
      throw new Error(
        'FATAL: INTERNAL_SERVICE_KEY environment variable is required in production.',
      );
    }
    this.internalApiKey = internalApiKey;
  }

  public validate(incomingKey?: string): boolean {
    if (!incomingKey) {
      throw new UnauthorizedTenantAccessException(
        'Unauthorized internal machine-to-machine request: Missing key.',
      );
    }

    const keyBuf = Buffer.from(incomingKey);
    const expectedBuf = Buffer.from(this.internalApiKey);

    if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
      throw new UnauthorizedTenantAccessException(
        'Unauthorized internal machine-to-machine request: Invalid key.',
      );
    }

    return true;
  }
}
