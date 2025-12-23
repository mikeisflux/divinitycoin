// lib/logger.ts
// SECURITY: Centralized logging utility that sanitizes sensitive data
// Use this instead of console.log/console.error to prevent data leaks

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /sk_[a-zA-Z0-9_]+/g,  // Stripe secret keys
  /pk_[a-zA-Z0-9_]+/g,  // Stripe publishable keys
  /whsec_[a-zA-Z0-9_]+/g,  // Stripe webhook secrets
  /SG\.[a-zA-Z0-9_-]+/g,  // SendGrid API keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi,  // Bearer tokens
  /password['":\s]+['"]?[^'"\s,}]+/gi,  // Passwords
  /passwordHash['":\s]+['"]?[^'"\s,}]+/gi,  // Password hashes
  /secret['":\s]+['"]?[^'"\s,}]+/gi,  // Secrets
  /apiKey['":\s]+['"]?[^'"\s,}]+/gi,  // API keys
  /token['":\s]+['"]?[a-zA-Z0-9._-]{20,}/gi,  // Long tokens
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // Email addresses (partial redaction)
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,  // Credit card numbers
  /\b\d{9}\b/g,  // Routing numbers (9 digits)
  /bankAccountNumber['":\s]+['"]?\d+/gi,  // Bank account numbers
  /bankRoutingNumber['":\s]+['"]?\d+/gi,  // Bank routing numbers
];

// Keys to completely remove from objects
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'secret',
  'apiKey',
  'token',
  'sessionToken',
  'bankAccountNumber',
  'bankRoutingNumber',
  'bankAccountEncrypted',
  'bankRoutingEncrypted',
  'stripeSecretKey',
  'webhookSecret',
  'encryptionSecret',
  'csrfSecret',
]);

/**
 * Sanitize a string by redacting sensitive patterns
 */
function sanitizeString(str: string): string {
  let result = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Sanitize an object by removing/redacting sensitive keys
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      // Only include stack in development
      ...(process.env.NODE_ENV === 'development' && { stack: sanitizeString(obj.stack || '') }),
    };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Format log arguments for output
 */
function formatArgs(args: unknown[]): unknown[] {
  return args.map(arg => sanitizeObject(arg));
}

/**
 * Main logger object
 */
export const logger = {
  debug(...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', ...formatArgs(args));
    }
  },

  info(...args: unknown[]): void {
    console.info('[INFO]', ...formatArgs(args));
  },

  warn(...args: unknown[]): void {
    console.warn('[WARN]', ...formatArgs(args));
  },

  error(...args: unknown[]): void {
    console.error('[ERROR]', ...formatArgs(args));
  },

  /**
   * Log an error with context, suitable for production
   */
  logError(message: string, error: unknown, context?: Record<string, unknown>): void {
    const sanitizedContext = context ? sanitizeObject(context) : undefined;
    const sanitizedError = sanitizeObject(error);

    console.error('[ERROR]', message, {
      error: sanitizedError,
      ...(sanitizedContext && { context: sanitizedContext }),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Log an API error - minimal info for production, detailed for development
   */
  apiError(endpoint: string, error: unknown, requestId?: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('[API_ERROR]', endpoint, sanitizeObject(error));
    } else {
      // In production, only log minimal info
      console.error('[API_ERROR]', endpoint, {
        requestId,
        errorType: error instanceof Error ? error.name : typeof error,
        timestamp: new Date().toISOString(),
      });
    }
  },
};

export default logger;
