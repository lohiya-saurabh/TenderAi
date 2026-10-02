export interface TenantContext {
  organizationId: string;
  userId: string;
  role: 'ADMIN' | 'BID_MANAGER' | 'VIEWER';
}

export class TenantContextHolder {
  private static currentContext: TenantContext | null = null;

  public static set(context: TenantContext): void {
    this.currentContext = context;
  }

  public static get(): TenantContext | null {
    return this.currentContext;
  }

  public static clear(): void {
    this.currentContext = null;
  }
}
