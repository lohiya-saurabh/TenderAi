/**
 * TenantContextInterceptor — Binds Authenticated Identity to Fiber-Safe AsyncLocalStorage
 *
 * Ensures that all downstream services, repositories, and domain events automatically
 * inherit the verified tenant context and userId without passing them manually.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextHolder } from '../TenantContext.js';
import type { UserTokenPayload } from '../TokenService.js';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user: UserTokenPayload = request.user;

    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      TenantContextHolder.run(
        {
          organizationId: user.organizationId,
          userId: user.sub,
          role: user.role,
          requestId: (request.headers['x-request-id'] as string) || `req_${Date.now()}`,
        },
        () => {
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
