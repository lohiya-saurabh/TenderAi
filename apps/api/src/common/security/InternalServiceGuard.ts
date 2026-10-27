import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedTenantAccessException } from '@/common/domain/DomainException.js';

export class InternalServiceGuard {
  private readonly internalApiKey: string;

  constructor(configOrKey?: ConfigService | string) {
    let key: string | undefined;
    let nodeEnv: string | undefined;

    if (configOrKey instanceof ConfigService) {
      key = configOrKey.get<string>('INTERNAL_SERVICE_KEY');
      nodeEnv = configOrKey.get<string>('NODE_ENV');
    } else if (typeof configOrKey === 'string') {
      key = configOrKey;
      nodeEnv = new ConfigService().get<string>('NODE_ENV');
    } else {
      const config = new ConfigService();
      key = config.get<string>('INTERNAL_SERVICE_KEY');
      nodeEnv = config.get<string>('NODE_ENV');
    }

    if (nodeEnv === 'production' && !key) {
      throw new Error(
        'FATAL: INTERNAL_SERVICE_KEY environment variable is required in production.',
      );
    }
    this.internalApiKey = key ?? 'tenderpulse-internal-secret-2026';
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
