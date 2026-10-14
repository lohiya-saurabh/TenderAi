import type { LoggerService } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { LoggingContextHolder } from './LoggingContext.js';
import { LogSanitizer } from './LogSanitizer.js';
import { RotatingLogStream } from './RotatingLogStream.js';

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
  private static fileStream: RotatingLogStream | null = null;

  private readonly contextName: string;
  private readonly serviceName: string;
  private readonly environment: string;

  constructor(contextName = 'API', serviceName = 'api') {
    this.contextName = contextName;
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || 'development';
  }

  public static getRotatingFileStream(): RotatingLogStream | null {
    if (process.env.LOG_TO_FILE === 'false') {
      return null;
    }
    if (!this.fileStream) {
      const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      if (isTest && process.env.LOG_TO_FILE !== 'true') {
        return null;
      }

      const logDir =
        process.env.LOG_DIR ||
        (fs.existsSync(path.resolve(process.cwd(), 'apps/api')) ? 'logs' : '../../logs');
      const resolvedDir = path.resolve(process.cwd(), logDir);
      const filePath = path.join(resolvedDir, 'api.log');

      const maxBytes = process.env.LOG_MAX_BYTES
        ? parseInt(process.env.LOG_MAX_BYTES, 10)
        : 10 * 1024 * 1024;
      const maxFiles = process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES, 10) : 5;

      this.fileStream = new RotatingLogStream({
        filePath,
        maxBytes,
        maxFiles,
      });
    }
    return this.fileStream;
  }

  private getConsoleMinLevel(): LogLevelName {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (isTest) {
      const envLevel = (process.env.LOG_LEVEL || '').toUpperCase();
      if (envLevel in LOG_LEVEL_PRIORITY) return envLevel as LogLevelName;
      return 'DEBUG';
    }

    const consoleLevel = (
      process.env.LOG_LEVEL_CONSOLE ||
      process.env.LOG_LEVEL ||
      ''
    ).toUpperCase();
    if (consoleLevel in LOG_LEVEL_PRIORITY) {
      return consoleLevel as LogLevelName;
    }
    return this.environment === 'production' ? 'WARN' : 'INFO';
  }

  private getFileMinLevel(): LogLevelName {
    const fileLevel = (process.env.LOG_LEVEL_FILE || process.env.LOG_LEVEL || '').toUpperCase();
    if (fileLevel in LOG_LEVEL_PRIORITY) {
      return fileLevel as LogLevelName;
    }
    return 'DEBUG';
  }

  private shouldLogToConsole(level: LogLevelName, event?: string, message?: string): boolean {
    if (process.env.LOG_TO_CONSOLE === 'false') {
      return false;
    }
    const minLevel = this.getConsoleMinLevel();
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return false;
    }

    // Suppress noisy framework route discovery and module initialization spam on console
    // unless console level is explicitly set to DEBUG
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (!isTest && minLevel !== 'DEBUG') {
      if (event === 'app.info' || event === 'app.verbose') {
        const msg = message || '';
        if (
          msg.startsWith('Mapped {') ||
          msg.endsWith('dependencies initialized') ||
          msg.includes('Controller {/')
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private shouldLogToFile(level: LogLevelName): boolean {
    const minLevel = this.getFileMinLevel();
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
  }

  private formatAndEmit(payload: StructuredLogPayload): void {
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

    // Deep sanitize any potential secrets, credentials, or oversized document bodies
    const sanitized = LogSanitizer.sanitize(fullPayload) as StructuredLogPayload;
    const jsonString = JSON.stringify(sanitized);

    // 1. Write to rotating file stream (full structured JSON)
    const fileStream = StructuredLogger.getRotatingFileStream();
    if (fileStream && this.shouldLogToFile(sanitized.level)) {
      fileStream.write(jsonString + '\n');
    }

    // 2. Write to console (stdout / stderr)
    if (this.shouldLogToConsole(sanitized.level, sanitized.event, sanitized.message)) {
      const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

      // In tests, or if LOG_FORMAT=json, output JSON string
      if (isTest || process.env.LOG_FORMAT === 'json') {
        if (sanitized.level === 'ERROR' || sanitized.level === 'FATAL') {
          process.stderr.write(jsonString + '\n');
        } else {
          process.stdout.write(jsonString + '\n');
        }
        return;
      }

      // Default for development / terminal: Clean, human-friendly one-liner
      const timeStr = sanitized.timestamp
        ? sanitized.timestamp.slice(11, 19)
        : new Date().toISOString().slice(11, 19);
      const traceTag = sanitized.trace_id ? ` [${sanitized.trace_id.slice(0, 12)}]` : '';
      const tenantTag = sanitized.tenant_id ? ` [${sanitized.tenant_id}]` : '';
      const durationTag = sanitized.duration_ms !== null ? ` (${sanitized.duration_ms}ms)` : '';
      const formatted = `[${timeStr}] ${sanitized.level.padEnd(5)} [${this.contextName}]${traceTag}${tenantTag} ${sanitized.message}${durationTag}`;

      if (sanitized.level === 'ERROR' || sanitized.level === 'FATAL') {
        process.stderr.write(formatted + '\n');
      } else {
        process.stdout.write(formatted + '\n');
      }
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

  public info(eventOrMessage: unknown, ...optionalParams: unknown[]): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('INFO', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata =
      optionalParams[0] && typeof optionalParams[0] === 'object'
        ? (optionalParams[0] as Record<string, unknown>)
        : undefined;
    this.logStructured('INFO', 'app.info', message, metadata);
  }

  public warn(eventOrMessage: unknown, ...optionalParams: unknown[]): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('WARN', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata =
      optionalParams[0] && typeof optionalParams[0] === 'object'
        ? (optionalParams[0] as Record<string, unknown>)
        : undefined;
    this.logStructured('WARN', 'app.warn', message, metadata);
  }

  public error(eventOrMessage: unknown, ...optionalParams: unknown[]): void {
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
    const metadata = (
      optionalParams[1] && typeof optionalParams[1] === 'object' ? optionalParams[1] : undefined
    ) as Record<string, unknown> | undefined;

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

  public debug(eventOrMessage: unknown, ...optionalParams: unknown[]): void {
    if (typeof eventOrMessage === 'string' && typeof optionalParams[0] === 'string') {
      const event = eventOrMessage;
      const message = optionalParams[0];
      const metadata = optionalParams[1] as Record<string, unknown> | undefined;
      const extra = optionalParams[2] as Partial<StructuredLogPayload> | undefined;
      this.logStructured('DEBUG', event, message, metadata, extra);
      return;
    }

    const message = String(eventOrMessage);
    const metadata =
      optionalParams[0] && typeof optionalParams[0] === 'object'
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
