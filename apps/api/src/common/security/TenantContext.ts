import { AsyncLocalStorage } from 'node:async_hooks';
import { UserRole, Permission, hasPermission } from '@/common/security/permissions.js';
import { UnauthorizedTenantAccessException } from '@/common/domain/DomainException.js';

export interface TenantContext {
  organizationId: string;
  userId: string;
  /** Display name from the verified token, recorded on reviews and audit events. */
  userName?: string;
  role: UserRole;
  requestId?: string;
}

/**
 * Fiber-safe, request-scoped tenant context holder backed by Node.js AsyncLocalStorage.
 * Eliminates static variable race conditions across concurrent async operations.
 */
export class TenantContextHolder {
  private static readonly storage = new AsyncLocalStorage<TenantContext>();
  private static fallbackContext: TenantContext | null = null;

  /**
   * Runs a function or promise within an isolated tenant context.
   */
  public static run<T>(context: TenantContext, callback: () => T | Promise<T>): Promise<T> {
    return Promise.resolve(this.storage.run(context, callback));
  }

  /**
   * Sets the active tenant context for the current execution and downstream async operations,
   * also registering it as fallback for test harnesses where async hooks don't cross Vitest boundaries.
   */
  public static enter(context: TenantContext): void {
    this.storage.enterWith(context);
    this.fallbackContext = context;
  }

  /**
   * Explicitly sets or clears the fallback tenant context (primarily for unit test setups).
   */
  public static setFallback(context: TenantContext | null): void {
    this.fallbackContext = context;
  }

  /**
   * Returns the current tenant context, or null if unauthenticated.
   */
  public static get(): TenantContext | null {
    return this.storage.getStore() ?? this.fallbackContext;
  }

  /**
   * Returns the current tenant context, throwing if missing.
   */
  public static getRequired(): TenantContext {
    const ctx = this.get();
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
        `Role '${ctx.role}' lacks required permission '${permission}'.`,
      );
    }
  }
}
