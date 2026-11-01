/**
 * TenantContextInterceptor — Binds Authenticated Identity to Fiber-Safe AsyncLocalStorage
 *
 * Ensures that all downstream services, repositories, and domain events automatically
 * inherit the verified tenant context and userId without passing them manually.
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import type { UserTokenPayload } from '@/common/security/TokenService.js';

import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user: UserTokenPayload = request.user;

    if (!user) {
      return next.handle();
    }

    const requestId = (request.headers['x-request-id'] as string) || `req_${Date.now()}`;

    return new Observable((subscriber) => {
      TenantContextHolder.run(
        {
          organizationId: user.organizationId,
          userId: user.sub,
          userName: user.name || user.email,
          role: user.role,
          requestId,
        },
        () => {
          LoggingContextHolder.merge({
            tenantId: user.organizationId,
            userId: user.sub,
            requestId,
          });

          const subscription = next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });

          return () => subscription.unsubscribe();
        },
      );
    });
  }
}
