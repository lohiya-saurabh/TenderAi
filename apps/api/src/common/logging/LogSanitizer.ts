/**
 * LogSanitizer — Zero-Trust Log Scrubber
 *
 * Deterministically strips credentials, authentication tokens, presigned URL signatures,
 * database passwords, and Indian statutory identifiers (PAN, GSTIN, Aadhaar) prior to log output.
 */

export class LogSanitizer {
  private static readonly SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // AWS Access Key ID
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },
    // AWS Secret Access Key
    {
      pattern: /(aws_secret_access_key\s*[:=]\s*['"]?)[A-Za-z0-9/+=]{40}(['"]?)/gi,
      replacement: '$1[REDACTED]$2',
    },
    // Bearer Tokens / Authorization Headers
    {
      pattern: /Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      replacement: 'Bearer [REDACTED_JWT]',
    },
    { pattern: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/g, replacement: 'Bearer [REDACTED_TOKEN]' },
    // Standalone JWT
    {
      pattern: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\b/g,
      replacement: '[REDACTED_JWT]',
    },
    // Database connection strings (PostgreSQL, MySQL)
    {
      pattern:
        /postgres(ql)?:\/\/([a-zA-Z0-9_\-]+):([^@]+)@([a-zA-Z0-9_.\-]+:[0-9]+\/[a-zA-Z0-9_\-]+)/gi,
      replacement: 'postgres://$2:[REDACTED]@$4',
    },
    // Private Keys
    {
      pattern: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END \1 PRIVATE KEY-----/g,
      replacement: '[REDACTED_PRIVATE_KEY]',
    },
    // Presigned S3/GCS query parameters containing signatures/tokens
    {
      pattern:
        /([?&](X-Amz-Signature|X-Goog-Signature|Signature|sig|signature|token|access_token|apiKey)=)[^&"'\s]+/gi,
      replacement: '$1[REDACTED]',
    },
    // Generic API Keys / Passwords in JSON / query params / config
    {
      pattern:
        /(["']?(?:password|secret|apiKey|api_key|internalServiceKey|internal_service_key|refreshToken|refresh_token)["']?\s*[:=]\s*["'])[^"']+(["'])/gi,
      replacement: '$1[REDACTED]$2',
    },
    // Indian GSTIN (15 characters: 2 digits + 5 alpha + 4 digits + 1 alpha + 1 alpha/num + Z + 1 alpha/num)
    {
      pattern: /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g,
      replacement: '[REDACTED_GSTIN]',
    },
    // Indian PAN (10 characters: 5 alpha + 4 digits + 1 alpha)
    { pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, replacement: '[REDACTED_PAN]' },
    // Indian Aadhaar (12 digits, often formatted as 4-4-4)
    { pattern: /\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g, replacement: '[REDACTED_AADHAAR]' },
  ];

  private static readonly CONTENT_KEYS_TO_TRUNCATE = new Set([
    'prompt',
    'full_prompt',
    'system_prompt',
    'user_prompt',
    'document_content',
    'documentcontent',
    'raw_page_text',
    'rawpagetext',
    'page_text',
    'pagetext',
    'extracted_text',
    'extractedtext',
    'file_content',
    'filecontent',
    'body_text',
  ]);

  private static readonly MAX_CONTENT_STRING_LENGTH = 250;
  private static readonly MAX_GENERIC_STRING_LENGTH = 3000;

  /**
   * Sanitizes a string by running it through the precompiled secret patterns and length bounds.
   */
  public static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return input;
    let result = input;
    for (const { pattern, replacement } of this.SECRET_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    if (result.length > this.MAX_GENERIC_STRING_LENGTH) {
      result = `${result.slice(0, this.MAX_GENERIC_STRING_LENGTH)}... [TRUNCATED: ${result.length - this.MAX_GENERIC_STRING_LENGTH} chars omitted for log safety]`;
    }
    return result;
  }

  /**
   * Deeply sanitizes any primitive, array, or object structure, protecting against circular references.
   */
  public static sanitize<T>(input: T, seen = new WeakSet<object>()): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return this.sanitizeString(input) as unknown as T;
    }

    if (typeof input !== 'object') {
      return input;
    }

    if (input instanceof Date) {
      return input;
    }

    if (input instanceof Error) {
      const sanitizedError: Record<string, unknown> = {
        name: input.name,
        message: this.sanitizeString(input.message),
        stack: input.stack ? this.sanitizeString(input.stack) : undefined,
      };
      if ('code' in input) {
        sanitizedError.code = (input as { code: unknown }).code;
      }
      return sanitizedError as unknown as T;
    }

    if (seen.has(input)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item, seen)) as unknown as T;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      // Fast property-name masking for known sensitive properties
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('internalservicekey')
      ) {
        output[key] = '[REDACTED]';
      } else if (
        typeof value === 'string' &&
        this.CONTENT_KEYS_TO_TRUNCATE.has(lowerKey) &&
        value.length > this.MAX_CONTENT_STRING_LENGTH
      ) {
        const sanitizedSnippet = this.sanitizeString(value.slice(0, this.MAX_CONTENT_STRING_LENGTH));
        output[key] = `${sanitizedSnippet}... [TRUNCATED: ${value.length - this.MAX_CONTENT_STRING_LENGTH} chars omitted for log safety]`;
      } else {
        output[key] = this.sanitize(value, seen);
      }
    }

    return output as unknown as T;
  }
}
