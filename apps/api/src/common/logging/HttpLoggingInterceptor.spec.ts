import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { HttpLoggingInterceptor } from '@/common/logging/HttpLoggingInterceptor.js';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let capturedLogs: Record<string, unknown>[] = [];

  beforeEach(() => {
    interceptor = new HttpLoggingInterceptor();
    capturedLogs = [];
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      try {
        capturedLogs.push(JSON.parse(String(chunk)));
      } catch {
        // Ignored
      }
      return true;
    });
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  it('sets X-Trace-Id and logs http.request.completed with duration_ms and status code', async () => {
    const headers: Record<string, string> = {
      'x-trace-id': 'trc_custom_12345',
      'x-correlation-id': 'corr_custom_99999',
    };
    const responseHeaders: Record<string, string> = {};

    const mockRequest = {
      method: 'GET',
      originalUrl: '/api/v1/bids/bid-test-01/documents',
      url: '/api/v1/bids/bid-test-01/documents',
      headers,
      params: { bidId: 'bid-test-01' },
      user: { organizationId: 'org_test_123', sub: 'user_456' },
      route: { path: '/api/v1/bids/:bidId/documents' },
      ip: '127.0.0.1',
    };

    const mockResponse = {
      statusCode: 200,
      setHeader: (key: string, val: string) => {
        responseHeaders[key] = val;
      },
    };

    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    const observable = interceptor.intercept(mockContext, mockHandler);

    await new Promise((resolve) => {
      observable.subscribe({
        complete: resolve,
      });
    });

    expect(responseHeaders['X-Trace-Id']).toBe('trc_custom_12345');
    expect(responseHeaders['X-Correlation-Id']).toBe('corr_custom_99999');

    const completedLog = capturedLogs.find((l) => l.event === 'http.request.completed');
    expect(completedLog).toBeDefined();
    expect(completedLog.trace_id).toBe('trc_custom_12345');
    expect(completedLog.correlation_id).toBe('corr_custom_99999');
    expect(completedLog.tenant_id).toBe('org_test_123');
    expect(completedLog.tender_id).toBe('bid-test-01');
    expect(completedLog.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
