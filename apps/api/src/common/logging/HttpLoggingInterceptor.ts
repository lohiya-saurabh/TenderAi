import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Request, Response } from 'express';
import { LoggingContextHolder } from './LoggingContext.js';
import { StructuredLogger } from './StructuredLogger.js';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger('HTTP', 'api');

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const traceId =
      (req.headers['x-trace-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      `trc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const correlationId =
      (req.headers['x-correlation-id'] as string) || traceId;

    const requestId =
      (req.headers['x-request-id'] as string) ||
      `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // Set trace headers on the response for client observability
    if (res.setHeader) {
      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Correlation-Id', correlationId);
    }

    const tenantId =
      (req as unknown as { user?: { organizationId?: string } }).user?.organizationId ||
      (req.headers['x-tenant-id'] as string) ||
      undefined;

    const userId =
      (req as unknown as { user?: { sub?: string } }).user?.sub ||
      undefined;

    const getParamString = (val: unknown): string | undefined => {
      if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : undefined;
      return typeof val === 'string' ? val : undefined;
    };

    const rawBidId = getParamString(req.params?.bidId);
    const rawTenderId = getParamString(req.params?.tenderId);
    const rawId = getParamString(req.params?.id);
    const rawDocId = getParamString(req.params?.documentId);

    const tenderId =
      rawBidId || rawTenderId || (rawId?.startsWith('bid-') ? rawId : undefined);

    const documentId =
      rawDocId || (rawId?.startsWith('doc-') ? rawId : undefined);

    const startTime = performance.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    return new Observable((subscriber) => {
      LoggingContextHolder.run(
        {
          traceId,
          correlationId,
          requestId,
          tenantId,
          userId,
          tenderId,
          documentId,
        },
        () => {
          this.logger.debug('http.request.received', `${method} ${url}`, {
            method,
            url,
            ip: req.ip,
          });

          const subscription = next
            .handle()
            .pipe(
              tap(() => {
                const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
                const statusCode = res.statusCode || 200;
                const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

                this.logger.logStructured(
                  level,
                  'http.request.completed',
                  `${method} ${url} ${statusCode} (${durationMs}ms)`,
                  {
                    method,
                    route: req.route?.path || url,
                    status_code: statusCode,
                  },
                  {
                    duration_ms: durationMs,
                  },
                );
              }),
              catchError((err: unknown) => {
                const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
                const statusCode =
                  typeof err === 'object' && err !== null && 'status' in err
                    ? (err as { status: number }).status
                    : 500;

                this.logger.error(
                  'http.request.failed',
                  `${method} ${url} failed with ${statusCode} (${durationMs}ms)`,
                  err,
                  {
                    method,
                    route: req.route?.path || url,
                    status_code: statusCode,
                  },
                  {
                    duration_ms: durationMs,
                  },
                );
                throw err;
              }),
            )
            .subscribe({
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
