/**
 * @file rate-limiter.ts
 * @description Rate limiting implementation for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import type { RateLimitConfig } from './types';
import { RateLimitExceededError } from './exceptions';

/**
 * Token bucket rate limiter implementation.
 *
 * This rate limiter uses the token bucket algorithm to control the rate
 * of requests. Tokens are added to the bucket at a fixed rate, and each
 * request consumes one token. If no tokens are available, the request
 * is blocked until tokens become available.
 *
 * @example
 * ```typescript
 * const config = { maxRequests: 100, windowSeconds: 60, enabled: true };
 * const rateLimiter = new TokenBucketRateLimiter(config);
 * await rateLimiter.acquire(); // Blocks if rate limit exceeded
 * ```
 */
export class TokenBucketRateLimiter {
  private readonly config: Required<RateLimitConfig>;
  private readonly enabled: boolean;
  private readonly maxRequests: number;
  private readonly windowSeconds: number;
  private readonly refillRate: number;
  private tokens: number;
  private lastRefill: number;

  /**
   * Initialize rate limiter.
   *
   * @param config - Rate limit configuration
   *
   * @example
   * ```typescript
   * const config = { maxRequests: 100, windowSeconds: 60, enabled: true };
   * const rateLimiter = new TokenBucketRateLimiter(config);
   * ```
   */
  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests ?? 100,
      windowSeconds: config.windowSeconds ?? 60,
      enabled: config.enabled ?? true,
    };

    this.enabled = this.config.enabled;
    this.maxRequests = this.config.maxRequests;
    this.windowSeconds = this.config.windowSeconds;

    // Token bucket state
    this.tokens = this.maxRequests;
    this.lastRefill = Date.now();

    // Calculate refill rate (tokens per millisecond)
    this.refillRate = this.maxRequests / (this.windowSeconds * 1000);
  }

  /**
   * Refill tokens based on elapsed time.
   *
   * Tokens are added to the bucket at a constant rate based on
   * the configured refill rate.
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Calculate tokens to add
    const tokensToAdd = elapsed * this.refillRate;

    // Add tokens, capping at maxRequests
    this.tokens = Math.min(this.tokens + tokensToAdd, this.maxRequests);
    this.lastRefill = now;
  }

  /**
   * Acquire tokens from the bucket.
   *
   * @param tokens - Number of tokens to acquire (default: 1)
   * @param block - Whether to block if tokens are not available (default: true)
   * @param timeout - Maximum time to wait in milliseconds (default: undefined, wait forever)
   * @returns Promise that resolves to true if tokens were acquired
   * @throws RateLimitExceededError if blocking is disabled and rate limit exceeded
   *
   * @example
   * ```typescript
   * await rateLimiter.acquire(); // Acquire 1 token
   * await rateLimiter.acquire(5); // Acquire 5 tokens
   * await rateLimiter.acquire(1, false); // Non-blocking
   * ```
   */
  async acquire(tokens: number = 1, block: boolean = true, timeout?: number): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const startTime = Date.now();

    while (true) {
      // Refill tokens
      this.refillTokens();

      // Check if enough tokens available
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return true;
      }

      // If not blocking, throw exception
      if (!block) {
        throw new RateLimitExceededError(this.windowSeconds);
      }

      // Check timeout
      if (timeout !== undefined) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          return false;
        }
      }

      // Calculate wait time
      const tokensNeeded = tokens - this.tokens;
      const waitTime = Math.min(tokensNeeded / this.refillRate, 1000); // Max 1 second at a time

      // Wait
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Reset the rate limiter to initial state.
   *
   * This refills all tokens and resets the refill timestamp.
   *
   * @example
   * ```typescript
   * rateLimiter.reset();
   * ```
   */
  reset(): void {
    this.tokens = this.maxRequests;
    this.lastRefill = Date.now();
  }

  /**
   * Get the number of currently available tokens.
   *
   * @returns Number of available tokens
   *
   * @example
   * ```typescript
   * const available = rateLimiter.getAvailableTokens();
   * console.log(`${available} requests available`);
   * ```
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Get estimated wait time to acquire tokens.
   *
   * @param tokens - Number of tokens to acquire
   * @returns Estimated wait time in milliseconds
   *
   * @example
   * ```typescript
   * const waitTime = rateLimiter.getWaitTime(10);
   * console.log(`Wait ${waitTime}ms for 10 tokens`);
   * ```
   */
  getWaitTime(tokens: number = 1): number {
    this.refillTokens();

    if (this.tokens >= tokens) {
      return 0;
    }

    const tokensNeeded = tokens - this.tokens;
    return tokensNeeded / this.refillRate;
  }
}

/**
 * Sliding window rate limiter implementation.
 *
 * This rate limiter uses a sliding window to track requests over time.
 * It's more accurate than token bucket but uses more memory.
 *
 * @example
 * ```typescript
 * const config = { maxRequests: 100, windowSeconds: 60, enabled: true };
 * const rateLimiter = new SlidingWindowRateLimiter(config);
 * await rateLimiter.acquire();
 * ```
 */
export class SlidingWindowRateLimiter {
  private readonly config: Required<RateLimitConfig>;
  private readonly enabled: boolean;
  private readonly maxRequests: number;
  private readonly windowSeconds: number;
  private requests: number[];

  /**
   * Initialize sliding window rate limiter.
   *
   * @param config - Rate limit configuration
   */
  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests ?? 100,
      windowSeconds: config.windowSeconds ?? 60,
      enabled: config.enabled ?? true,
    };

    this.enabled = this.config.enabled;
    this.maxRequests = this.config.maxRequests;
    this.windowSeconds = this.config.windowSeconds;

    // Array to store request timestamps
    this.requests = [];
  }

  /**
   * Remove requests older than the window.
   */
  private cleanOldRequests(): void {
    const now = Date.now();
    const cutoff = now - this.windowSeconds * 1000;

    this.requests = this.requests.filter((timestamp) => timestamp > cutoff);
  }

  /**
   * Acquire permission to make a request.
   *
   * @param block - Whether to block if rate limit exceeded
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise that resolves to true if permission granted
   * @throws RateLimitExceededError if blocking is disabled and rate limit exceeded
   *
   * @example
   * ```typescript
   * await rateLimiter.acquire(); // Blocking
   * await rateLimiter.acquire(false); // Non-blocking
   * ```
   */
  async acquire(block: boolean = true, timeout?: number): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const startTime = Date.now();

    while (true) {
      // Clean old requests
      this.cleanOldRequests();

      // Check if we can make a request
      if (this.requests.length < this.maxRequests) {
        this.requests.push(Date.now());
        return true;
      }

      // If not blocking, throw exception
      if (!block) {
        throw new RateLimitExceededError(this.windowSeconds);
      }

      // Check timeout
      if (timeout !== undefined) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          return false;
        }
      }

      // Calculate wait time (time until oldest request expires)
      if (this.requests.length > 0) {
        const oldestRequest = this.requests[0];
        const waitTime = Math.max(
          100,
          Math.min(oldestRequest! + this.windowSeconds * 1000 - Date.now(), 1000)
        );

        // Wait
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Reset the rate limiter.
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Get the number of requests in the current window.
   *
   * @returns Number of requests in current window
   */
  getRequestCount(): number {
    this.cleanOldRequests();
    return this.requests.length;
  }
}
