// lib/rateLimit.ts
// SECURITY: Rate limiting with lockout support to prevent brute-force attacks

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxAttempts: number;  // Max attempts per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface LockoutConfig {
  maxFailedAttempts: number;  // Max failed attempts before lockout
  lockoutDurationMs: number;  // Lockout duration in milliseconds
  trackingWindowMs: number;   // Window to track failed attempts
}

interface LockoutEntry {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number | null;
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
  /**
   * Whether `key` is currently over its limit, without counting this call.
   * Lets a caller refuse work for an IP that has already exhausted its
   * window — e.g. skip the database lookup for an API key when that IP has
   * already failed authentication twenty times — while only counting the
   * attempts that actually fail.
   */
  peek(key: string): { allowed: boolean; retryAfter?: number } {
    const entry = this.store.get(key);
    const now = Date.now();
    if (!entry || entry.resetAt <= now) return { allowed: true };
    if (entry.count >= this.maxAttempts) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
  }

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
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    });
  }
}

/**
 * Rate limiter with lockout support for failed attempts
 * SECURITY: Locks out after repeated failures to prevent brute-force attacks
 */
export class RateLimiterWithLockout {
  private store: Map<string, RateLimitEntry> = new Map();
  private lockoutStore: Map<string, LockoutEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockoutConfig: LockoutConfig;

  constructor(config: RateLimitConfig, lockoutConfig: LockoutConfig) {
    this.windowMs = config.windowMs;
    this.maxAttempts = config.maxAttempts;
    this.lockoutConfig = lockoutConfig;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if the key is rate limited or locked out
   * SECURITY: Checks lockout status first, then rate limit
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    retryAfter?: number;
    lockedOut?: boolean;
    lockoutRemaining?: number;
  } {
    const now = Date.now();

    // SECURITY: Check lockout first
    const lockout = this.lockoutStore.get(key);
    if (lockout && lockout.lockedUntil && lockout.lockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        lockedOut: true,
        lockoutRemaining: Math.ceil((lockout.lockedUntil - now) / 1000),
        retryAfter: Math.ceil((lockout.lockedUntil - now) / 1000),
      };
    }

    // Regular rate limit check
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
   * Record a failed attempt
   * SECURITY: Tracks failures and triggers lockout after threshold
   */
  recordFailure(key: string): {
    lockedOut: boolean;
    failedAttempts: number;
    lockoutRemaining?: number;
  } {
    const now = Date.now();
    let lockout = this.lockoutStore.get(key);

    // Initialize or reset if tracking window expired
    if (!lockout || (now - lockout.firstFailedAt) > this.lockoutConfig.trackingWindowMs) {
      lockout = {
        failedCount: 1,
        firstFailedAt: now,
        lockedUntil: null,
      };
      this.lockoutStore.set(key, lockout);
      return { lockedOut: false, failedAttempts: 1 };
    }

    // Increment failed count
    lockout.failedCount++;

    // SECURITY: Check if we should trigger lockout
    if (lockout.failedCount >= this.lockoutConfig.maxFailedAttempts) {
      lockout.lockedUntil = now + this.lockoutConfig.lockoutDurationMs;
      return {
        lockedOut: true,
        failedAttempts: lockout.failedCount,
        lockoutRemaining: Math.ceil(this.lockoutConfig.lockoutDurationMs / 1000),
      };
    }

    return { lockedOut: false, failedAttempts: lockout.failedCount };
  }

  /**
   * Record a successful attempt (resets lockout tracking)
   */
  recordSuccess(key: string): void {
    this.lockoutStore.delete(key);
  }

  /**
   * Get current lockout status
   */
  getLockoutStatus(key: string): {
    isLockedOut: boolean;
    failedAttempts: number;
    remainingAttempts: number;
    lockoutRemaining?: number;
  } {
    const now = Date.now();
    const lockout = this.lockoutStore.get(key);

    if (!lockout) {
      return {
        isLockedOut: false,
        failedAttempts: 0,
        remainingAttempts: this.lockoutConfig.maxFailedAttempts,
      };
    }

    if (lockout.lockedUntil && lockout.lockedUntil > now) {
      return {
        isLockedOut: true,
        failedAttempts: lockout.failedCount,
        remainingAttempts: 0,
        lockoutRemaining: Math.ceil((lockout.lockedUntil - now) / 1000),
      };
    }

    // Check if tracking window expired
    if ((now - lockout.firstFailedAt) > this.lockoutConfig.trackingWindowMs) {
      return {
        isLockedOut: false,
        failedAttempts: 0,
        remainingAttempts: this.lockoutConfig.maxFailedAttempts,
      };
    }

    return {
      isLockedOut: false,
      failedAttempts: lockout.failedCount,
      remainingAttempts: this.lockoutConfig.maxFailedAttempts - lockout.failedCount,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset lockout for a key (admin function)
   */
  resetLockout(key: string): void {
    this.lockoutStore.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Cleanup rate limit entries
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    });

    // Cleanup lockout entries (keep for a bit after lockout expires for audit)
    Array.from(this.lockoutStore.entries()).forEach(([key, entry]) => {
      // Remove if lockout expired more than 1 hour ago or tracking window passed
      const lockoutExpired = entry.lockedUntil && entry.lockedUntil < now - 3600000;
      const trackingExpired = (now - entry.firstFailedAt) > this.lockoutConfig.trackingWindowMs + 3600000;
      if (lockoutExpired || trackingExpired) {
        this.lockoutStore.delete(key);
      }
    });
  }
}

// Default rate limiter instances

// Redemption rate limiter with lockout: 5 requests/minute, lockout after 10 failed attempts for 15 minutes
export const redemptionRateLimiter = new RateLimiterWithLockout(
  {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'),
  },
  {
    maxFailedAttempts: 10,  // Lock after 10 failed attempts
    lockoutDurationMs: 15 * 60 * 1000,  // 15 minute lockout
    trackingWindowMs: 60 * 60 * 1000,  // Track failures within 1 hour
  }
);

// Pay endpoint rate limiter: 10 requests/minute
export const payRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxAttempts: 10, // 10 requests per minute
});

// General API rate limiter
/**
 * Partner API (/internal). Two limiters, both keyed so one partner cannot
 * affect another:
 *
 * - internalAuthFailureLimiter, per IP, counts only failed authentications.
 *   Twenty bad keys in ten minutes is not a partner with a typo.
 * - internalActionLimiter, per API key, 600 requests a minute. Far above any
 *   observed partner volume; exists so a stolen key cannot enumerate at
 *   machine speed, and so a 429 shows up in the request log as a signal.
 *
 * /internal is exempt from the generic middleware limiter and sits outside
 * nginx's /api/ zone, so these are the only limits it has.
 */
export const internalAuthFailureLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000,
  maxAttempts: 20,
});
export const internalActionLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxAttempts: 600,
});
/** Customer-facing auth endpoints that no other limiter covers. */
export const customerLoginLimiter = new RateLimiter({ windowMs: 60 * 1000, maxAttempts: 10 });
export const passwordResetLimiter = new RateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 5 });

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
