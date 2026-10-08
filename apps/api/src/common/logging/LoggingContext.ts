import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContextData {
  traceId?: string;
  correlationId?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  tenderId?: string;
  documentId?: string;
  jobId?: string;
  workflowId?: string;
  node?: string;
}

/**
 * Fiber-safe, request-scoped context storage backed by Node.js AsyncLocalStorage.
 * Automatically propagates trace IDs, tenant IDs, and job IDs down the async execution tree.
 */
export class LoggingContextHolder {
  private static readonly storage = new AsyncLocalStorage<LogContextData>();
  private static fallbackContext: LogContextData | null = null;

  public static run<T>(context: LogContextData, callback: () => T | Promise<T>): Promise<T> {
    const parent = this.storage.getStore();
    const merged = parent ? { ...parent, ...context } : context;
    return Promise.resolve(this.storage.run(merged, callback));
  }

  public static enter(context: LogContextData): void {
    const parent = this.storage.getStore();
    const merged = parent ? { ...parent, ...context } : context;
    this.storage.enterWith(merged);
    this.fallbackContext = merged;
  }

  public static get(): LogContextData {
    return this.storage.getStore() ?? this.fallbackContext ?? {};
  }

  public static setFallback(context: LogContextData | null): void {
    this.fallbackContext = context;
  }

  public static merge(partial: Partial<LogContextData>): void {
    const current = this.get();
    const updated = { ...current, ...partial };
    this.enter(updated);
  }
}
