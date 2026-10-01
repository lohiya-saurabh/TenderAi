import { UnauthorizedTenantAccessException } from '../domain/DomainException.js';

export class InternalServiceGuard {
  private readonly internalApiKey: string;

  constructor(internalApiKey = process.env['INTERNAL_SERVICE_KEY'] ?? 'tenderpulse-internal-secret-2026') {
    this.internalApiKey = internalApiKey;
  }

  public validate(incomingKey?: string): boolean {
    if (!incomingKey || incomingKey !== this.internalApiKey) {
      throw new UnauthorizedTenantAccessException('Unauthorized internal machine-to-machine request.');
    }
    return true;
  }
}
