import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StructuredLogger } from './StructuredLogger.js';
import { LoggingContextHolder } from './LoggingContext.js';
import { LogSanitizer } from './LogSanitizer.js';

describe('StructuredLogger & LogSanitizer', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  let capturedLogs: Record<string, unknown>[] = [];

  beforeEach(() => {
    capturedLogs = [];
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      try {
        capturedLogs.push(JSON.parse(String(chunk)));
      } catch {
        // Ignored for non-json writes
      }
      return true;
    });
    stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      try {
        capturedLogs.push(JSON.parse(String(chunk)));
      } catch {
        // Ignored for non-json writes
      }
      return true;
    });
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
    LoggingContextHolder.setFallback(null);
  });

  it('emits valid JSON logs adhering to the canonical schema', () => {
    const logger = new StructuredLogger('TestContext', 'api');

    logger.info('test.event', 'Test execution succeeded', { metric: 42 });

    expect(capturedLogs.length).toBe(1);
    const log = capturedLogs[0];
    expect(log).toHaveProperty('timestamp');
    expect(log.level).toBe('INFO');
    expect(log.service).toBe('api');
    expect(log.event).toBe('test.event');
    expect(log.message).toBe('Test execution succeeded');
    expect(log.metadata).toEqual({ metric: 42 });
  });

  it('automatically propagates fiber-safe context from LoggingContextHolder', async () => {
    const logger = new StructuredLogger('TestContext', 'api');

    await LoggingContextHolder.run(
      {
        traceId: 'trc_abc_999',
        correlationId: 'corr_xyz_888',
        tenantId: 'org_acme_infra',
        tenderId: 'bid-tender-001',
        documentId: 'doc-12345',
        jobId: 'job-98765',
      },
      async () => {
        logger.info('queue.job.started', 'Worker picked up message');
      },
    );

    expect(capturedLogs.length).toBe(1);
    const log = capturedLogs[0];
    expect(log.trace_id).toBe('trc_abc_999');
    expect(log.correlation_id).toBe('corr_xyz_888');
    expect(log.tenant_id).toBe('org_acme_infra');
    expect(log.tender_id).toBe('bid-tender-001');
    expect(log.document_id).toBe('doc-12345');
    expect(log.job_id).toBe('job-98765');
  });

  it('redacts Bearer tokens, JWTs, AWS credentials, and Presigned URL signatures', () => {
    const logger = new StructuredLogger('TestContext', 'api');

    const sampleUrl =
      'https://my-bucket.s3.ap-south-1.amazonaws.com/tenders/doc.pdf?X-Amz-Signature=secret123456789&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE';

    logger.info('storage.download', `Fetching ${sampleUrl}`, {
      authHeader:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_me',
      dbUrl: 'postgres://admin:superSecretPassword@db.tenderpulse.local:5432/tenderpulse',
    });

    expect(capturedLogs.length).toBe(1);
    const log = capturedLogs[0];
    expect(log.message).not.toContain('secret123456789');
    expect(log.message).toContain('X-Amz-Signature=[REDACTED]');
    expect(log.metadata.authHeader).toBe('Bearer [REDACTED_JWT]');
    expect(log.metadata.dbUrl).toBe(
      'postgres://admin:[REDACTED]@db.tenderpulse.local:5432/tenderpulse',
    );
  });

  it('redacts Indian statutory identifiers (PAN, GSTIN, Aadhaar)', () => {
    const rawPan = 'ABCDE1234F';
    const rawGstin = '29ABCDE1234F1Z5';
    const rawAadhaar = '2345 6789 0123';

    const sanitized = LogSanitizer.sanitizeString(
      `Company PAN: ${rawPan}, GSTIN: ${rawGstin}, Director Aadhaar: ${rawAadhaar}`,
    );

    expect(sanitized).not.toContain(rawPan);
    expect(sanitized).not.toContain(rawGstin);
    expect(sanitized).not.toContain(rawAadhaar);
    expect(sanitized).toContain('[REDACTED_PAN]');
    expect(sanitized).toContain('[REDACTED_GSTIN]');
    expect(sanitized).toContain('[REDACTED_AADHAAR]');
  });

  it('respects LOG_LEVEL environment variable filtering', () => {
    process.env.LOG_LEVEL = 'WARN';
    const logger = new StructuredLogger('TestContext', 'api');

    logger.debug('debug.event', 'Should be ignored');
    logger.info('info.event', 'Should be ignored');
    logger.warn('warn.event', 'Should be logged');

    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0].level).toBe('WARN');
    expect(capturedLogs[0].event).toBe('warn.event');
  });

  it('handles standard NestJS LoggerService signatures transparently', () => {
    const logger = new StructuredLogger('LegacyService', 'api');

    logger.log('Standard informational message');
    logger.warn('Warning condition');
    logger.error('Error encountered', new Error('Something broke'));

    expect(capturedLogs.length).toBe(3);
    expect(capturedLogs[0].level).toBe('INFO');
    expect(capturedLogs[0].message).toBe('Standard informational message');
    expect(capturedLogs[1].level).toBe('WARN');
    expect(capturedLogs[2].level).toBe('ERROR');
    expect(capturedLogs[2].metadata.errorMessage).toBe('Something broke');
  });

  it('truncates oversized prompts and raw document contents in log payloads', () => {
    const hugePrompt = 'Analyze this massive tender clause requirement '.repeat(50); // ~2350 chars
    const hugeDocument = 'Confidential tender specification sheet page 1 '.repeat(40); // ~1880 chars

    const sanitized = LogSanitizer.sanitize({
      prompt: hugePrompt,
      document_content: hugeDocument,
      smallField: 'normal value',
    }) as Record<string, string>;

    expect(sanitized.prompt).toContain('[TRUNCATED:');
    expect(sanitized.prompt.length).toBeLessThan(500);
    expect(sanitized.document_content).toContain('[TRUNCATED:');
    expect(sanitized.document_content.length).toBeLessThan(500);
    expect(sanitized.smallField).toBe('normal value');
  });

  it('rotates files and enforces retention count in RotatingLogStream', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const { RotatingLogStream } = await import('./RotatingLogStream.js');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-test-'));
    const logFile = path.join(tempDir, 'test.log');

    // Create stream with 200 bytes max and 3 backups
    const stream = new RotatingLogStream({
      filePath: logFile,
      maxBytes: 200,
      maxFiles: 3,
    });

    // Write ~80 bytes per line, 5 times -> should trigger rotations
    for (let i = 0; i < 5; i++) {
      stream.write(`Log line #${i}: ${'x'.repeat(70)}\n`);
    }

    await stream.end();

    // Verify rotation occurred and backups were created
    expect(fs.existsSync(logFile)).toBe(true);
    expect(fs.existsSync(`${logFile}.1`)).toBe(true);

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
