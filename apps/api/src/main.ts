/**
 * TenderPulse AI — NestJS Application Bootstrap
 *
 * Entry point that creates and configures the NestJS application
 * with Express platform, global CORS, exception filter, and body parsing.
 */
import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

// Tune stream pipeline listener headroom for GCS chunked streams and SSE clients
EventEmitter.defaultMaxListeners = 30;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress the NestJS ASCII art banner for cleaner logs
    logger: ['error', 'warn', 'log'],
  });

  // Global CORS — matches the previous server configuration
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With',
  });

  // Global exception filter — maps our HttpError subclasses to proper responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Body size limit (matches previous 1MB cap)
  // Express body-parser is auto-included by NestJS; configure limit
  app.use(await import('express').then((m) => m.json({ limit: '1mb' })));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`\n========================================================`);
  console.log(`🚀 TenderPulse AI API Server running at http://localhost:${port}`);
  console.log(`🐘 Persistence Engine: PostgreSQL 16 (PGlite in ./data/postgres)`);
  console.log(`🏗️  Framework: NestJS + Express`);
  console.log(`========================================================\n`);
}

bootstrap();
