/**
 * TenderPulse AI — NestJS Application Bootstrap
 *
 * Entry point that creates and configures the NestJS application
 * with Express platform, global CORS, exception filter, and body parsing.
 */
import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

import { StructuredLogger } from './common/logging/StructuredLogger.js';
import { HttpLoggingInterceptor } from './common/logging/HttpLoggingInterceptor.js';
import { resolveLogLevels } from './common/logger/log-level.util.js';

// Automatically load .env if present (native Node.js v20.6+)
for (const envPath of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // ignore
    }
  }
}

// Tune stream pipeline listener headroom for GCS chunked streams and SSE clients
EventEmitter.defaultMaxListeners = 30;

async function bootstrap() {
  const logger = new StructuredLogger('Bootstrap', 'api');
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Global HTTP Logging Interceptor for request tracing and latency metrics
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Global CORS — configured for secure credentials & cookie handling
  const allowedOrigins = process.env.APP_BASE_URL
    ? [process.env.APP_BASE_URL, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow non-browser requests or allowed frontend origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,X-Trace-Id,X-Correlation-Id,X-Request-Id',
  });

  // Global exception filter — maps our HttpError subclasses to proper responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Body size limit (matches previous 1MB cap)
  // Express body-parser is auto-included by NestJS; configure limit
  app.use(await import('express').then((m) => m.json({ limit: '1mb' })));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  logger.info('server.started', `🚀 TenderPulse AI API Server running at http://localhost:${port}`, {
    port,
    persistence: 'PostgreSQL 16 (PGlite in ./data/postgres)',
    logLevels: resolveLogLevels().join(', '),
  });
}

bootstrap();
