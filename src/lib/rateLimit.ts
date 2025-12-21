// lib/rateLimit.ts

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxAttempts: number;  // Max attempts per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxAttempts = config.maxAttempts;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if the key is rate limited
   * Returns { allowed: true } if under limit, { allowed: false, retryAfter } if limited
   */
  check(key: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No existing entry or expired entry
    if (!entry || entry.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
      };
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: this.maxAttempts - entry.count,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

// Default rate limiter instances
export const redemptionRateLimiter = new RateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'),
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxAttempts: 100, // 100 requests per minute
});

/**
 * Create a composite rate limit key
 */
export function createRateLimitKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}
