import { AsyncLocalStorage } from 'node:async_hooks';
import { UserRole, Permission, hasPermission } from './permissions.js';
import { UnauthorizedTenantAccessException } from '../domain/DomainException.js';

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: UserRole;
  requestId?: string;
}

/**
 * Fiber-safe, request-scoped tenant context holder backed by Node.js AsyncLocalStorage.
 * Eliminates static variable race conditions across concurrent async operations.
 */
export class TenantContextHolder {
  private static readonly storage = new AsyncLocalStorage<TenantContext>();

  /**
   * Runs a function or promise within an isolated tenant context.
   */
  public static run<T>(context: TenantContext, callback: () => T | Promise<T>): Promise<T> {
    return Promise.resolve(this.storage.run(context, callback));
  }

  /**
   * Returns the current tenant context, or null if unauthenticated.
   */
  public static get(): TenantContext | null {
    return this.storage.getStore() ?? null;
  }

  /**
   * Returns the current tenant context, throwing if missing.
   */
  public static getRequired(): TenantContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new UnauthorizedTenantAccessException('Missing active tenant context.');
    }
    return ctx;
  }

  /**
   * Verifies if the active tenant context possesses the required permission.
   */
  public static hasPermission(permission: Permission): boolean {
    const ctx = this.get();
    if (!ctx) return false;
    return hasPermission(ctx.role, permission);
  }

  /**
   * Asserts that the caller possesses the required permission, or throws.
   */
  public static requirePermission(permission: Permission): void {
    const ctx = this.getRequired();
    if (!hasPermission(ctx.role, permission)) {
      throw new UnauthorizedTenantAccessException(
        `Role '${ctx.role}' lacks required permission '${permission}'.`
      );
    }
  }
}
