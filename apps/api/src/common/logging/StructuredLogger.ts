import type { LoggerService } from '@nestjs/common';
import { LoggingContextHolder } from './LoggingContext.js';
import { LogSanitizer } from './LogSanitizer.js';

export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

const LOG_LEVEL_PRIORITY: Record<LogLevelName, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50,
};

export interface StructuredLogPayload {
  timestamp?: string;
  level: LogLevelName;
  service: string;
  environment: string;
  event: string;
  message: string;
  trace_id?: string | null;
  request_id?: string | null;
  correlation_id?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  tender_id?: string | null;
  document_id?: string | null;
  job_id?: string | null;
  workflow_id?: string | null;
  node?: string | null;
  duration_ms?: number | null;
  error_code?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export class StructuredLogger implements LoggerService {
  private readonly contextName: string;
  private readonly serviceName: string;
  private readonly environment: string;

  constructor(contextName = 'API', serviceName = 'api') {
    this.contextName = contextName;
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || 'development';
  }

  private getActiveMinLevel(): LogLevelName {
    const envLevel = (process.env.LOG_LEVEL || '').toUpperCase();
    if (envLevel in LOG_LEVEL_PRIORITY) {
      return envLevel as LogLevelName;
    }
    return this.environment === 'production' ? 'INFO' : 'DEBUG';
  }

  private shouldLog(level: LogLevelName): boolean {
    const minLevel = this.getActiveMinLevel();
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
  }

  private formatAndEmit(payload: StructuredLogPayload): void {
    if (!this.shouldLog(payload.level)) {
      return;
    }

    const context = LoggingContextHolder.get();

    const fullPayload: StructuredLogPayload = {
      timestamp: payload.timestamp || new Date().toISOString(),
      level: payload.level,
      service: this.serviceName,
      environment: this.environment,
      event: payload.event || 'app.message',
      message: payload.message,
      trace_id: payload.trace_id ?? context.traceId ?? null,
      request_id: payload.request_id ?? context.requestId ?? null,
      correlation_id: payload.correlation_id ?? context.correlationId ?? null,
      tenant_id: payload.tenant_id ?? context.tenantId ?? null,
      user_id: payload.user_id ?? context.userId ?? null,
      tender_id: payload.tender_id ?? context.tenderId ?? null,
      document_id: payload.document_id ?? context.documentId ?? null,
      job_id: payload.job_id ?? context.jobId ?? null,
      workflow_id: payload.workflow_id ?? context.workflowId ?? null,
      node: payload.node ?? context.node ?? null,
      duration_ms: payload.duration_ms ?? null,
      error_code: payload.error_code ?? null,
      metadata: payload.metadata || {},
    };

    // Deep sanitize any potential secrets or sensitive identifiers
    const sanitized = LogSanitizer.sanitize(fullPayload) as StructuredLogPayload;

    if (process.env.LOG_FORMAT === 'pretty') {
      const traceTag = sanitized.trace_id ? ` [${sanitized.trace_id}]` : '';
      const tenantTag = sanitized.tenant_id ? ` [tenant:${sanitized.tenant_id}]` : '';
      const durationTag = sanitized.duration_ms !== null ? ` (${sanitized.duration_ms}ms)` : '';
      const formatted = `[${sanitized.timestamp}] [${sanitized.level}] [${this.contextName}]${traceTag}${tenantTag} ${sanitized.event}: ${sanitized.message}${durationTag}`;
      if (sanitized.level === 'ERROR' || sanitized.level === 'FATAL') {
        process.stderr.write(formatted + '\n');
      } else {
        process.stdout.write(formatted + '\n');
      }
      return;
    }

    // Default: Single-line Structured JSON
    const jsonString = JSON.stringify(sanitized);
    if (sanitized.level === 'ERROR' || sanitized.level === 'FATAL') {
      process.stderr.write(jsonString + '\n');
    } else {
      process.stdout.write(jsonString + '\n');
    }
  }

  // Structured Logging Interface
  public logStructured(
    level: LogLevelName,
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
    extra?: Partial<StructuredLogPayload>,
  ): void {
    this.formatAndEmit({
      level,
      event,
      service: this.serviceName,
      environment: this.environment,
      message,
      metadata,
      ...extra,
    });
  }

  public info(
    eventOrMessage: unknown,
    ...optionalParams: unknown[]
  ): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('INFO', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata = optionalParams[0] && typeof optionalParams[0] === 'object'
      ? (optionalParams[0] as Record<string, unknown>)
      : undefined;
    this.logStructured('INFO', 'app.info', message, metadata);
  }

  public warn(
    eventOrMessage: unknown,
    ...optionalParams: unknown[]
  ): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('WARN', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata = optionalParams[0] && typeof optionalParams[0] === 'object'
      ? (optionalParams[0] as Record<string, unknown>)
      : undefined;
    this.logStructured('WARN', 'app.warn', message, metadata);
  }

  public error(
    eventOrMessage: unknown,
    ...optionalParams: unknown[]
  ): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const err = optionalParams[1];
      const metadata = optionalParams[2] as Record<string, unknown> | undefined;
      const extra = optionalParams[3] as Partial<StructuredLogPayload> | undefined;

      const errorMetadata: Record<string, unknown> = { ...(metadata || {}) };
      let errorCode: string | null = null;

      if (err instanceof Error) {
        errorMetadata.errorName = err.name;
        errorMetadata.errorMessage = err.message;
        errorMetadata.stack = err.stack;
        if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
          errorCode = (err as { code: string }).code;
        }
      } else if (err !== undefined) {
        errorMetadata.rawError = err;
      }

      this.logStructured('ERROR', event, message, errorMetadata, {
        error_code: errorCode ?? extra?.error_code,
        ...extra,
      });
      return;
    }

    const message = String(eventOrMessage);
    const err = optionalParams[0];
    const metadata = (optionalParams[1] && typeof optionalParams[1] === 'object'
      ? optionalParams[1]
      : undefined) as Record<string, unknown> | undefined;

    const errorMetadata: Record<string, unknown> = { ...(metadata || {}) };
    let errorCode: string | null = null;

    if (err instanceof Error) {
      errorMetadata.errorName = err.name;
      errorMetadata.errorMessage = err.message;
      errorMetadata.stack = err.stack;
      if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
        errorCode = (err as { code: string }).code;
      }
    } else if (err !== undefined) {
      errorMetadata.rawError = err;
    }

    this.logStructured('ERROR', 'app.error', message, errorMetadata, {
      error_code: errorCode,
    });
  }

  public debug(
    eventOrMessage: unknown,
    ...optionalParams: unknown[]
  ): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('DEBUG', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata = optionalParams[0] && typeof optionalParams[0] === 'object'
      ? (optionalParams[0] as Record<string, unknown>)
      : undefined;
    this.logStructured('DEBUG', 'app.debug', message, metadata);
  }

  // NestJS LoggerService standard implementations
  public log(message: unknown, ...optionalParams: unknown[]): void {
    if (typeof message === 'object' && message !== null && 'event' in message) {
      const obj = message as Record<string, unknown>;
      this.formatAndEmit({
        level: 'INFO',
        service: this.serviceName,
        environment: this.environment,
        event: String(obj.event),
        message: String(obj.message || ''),
        metadata: obj.metadata as Record<string, unknown>,
        ...obj,
      });
      return;
    }

    const context = typeof optionalParams[0] === 'string' ? optionalParams[0] : this.contextName;
    this.formatAndEmit({
      level: 'INFO',
      service: this.serviceName,
      environment: this.environment,
      event: 'app.info',
      message: String(message),
      metadata: { context },
    });
  }

  public verbose(message: unknown, ...optionalParams: unknown[]): void {
    const context = typeof optionalParams[0] === 'string' ? optionalParams[0] : this.contextName;
    this.formatAndEmit({
      level: 'DEBUG',
      service: this.serviceName,
      environment: this.environment,
      event: 'app.verbose',
      message: String(message),
      metadata: { context },
    });
  }

  public fatal(message: unknown, ...optionalParams: unknown[]): void {
    const context = typeof optionalParams[0] === 'string' ? optionalParams[0] : this.contextName;
    this.formatAndEmit({
      level: 'FATAL',
      service: this.serviceName,
      environment: this.environment,
      event: 'app.fatal',
      message: String(message),
      metadata: { context },
    });
  }
}
