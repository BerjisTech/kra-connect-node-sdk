/**
 * @file config.ts
 * @description Configuration management for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import { config as dotenvConfig } from 'dotenv';
import type { KraConfig, RetryConfig, CacheConfig, RateLimitConfig } from './types';

// Load environment variables
dotenvConfig();

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  retryOnTimeout: true,
  retryOnRateLimit: true,
};

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  enabled: true,
  ttl: 3600,
  maxSize: 1000,
};

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  maxRequests: 100,
  windowSeconds: 60,
  enabled: true,
};

/**
 * Configuration builder with validation
 */
export class ConfigBuilder {
  /**
   * Create configuration from environment variables.
   *
   * Reads configuration from environment variables with fallback to defaults.
   *
   * Environment Variables:
   * - KRA_API_KEY: API key (required if not passed as parameter)
   * - KRA_API_BASE_URL: Base URL for API
   * - KRA_TIMEOUT: Request timeout in milliseconds
   * - KRA_MAX_RETRIES: Maximum retry attempts
   * - KRA_CACHE_ENABLED: Whether caching is enabled (true/false)
   * - KRA_CACHE_TTL: Cache TTL in seconds
   * - KRA_RATE_LIMIT_MAX_REQUESTS: Max requests per window
   * - KRA_RATE_LIMIT_WINDOW_SECONDS: Rate limit window in seconds
   *
   * @param overrides - Optional configuration overrides
   * @returns Validated configuration object
   *
   * @example
   * ```typescript
   * // With .env file containing KRA_API_KEY
   * const config = ConfigBuilder.fromEnv();
   *
   * // Override specific values
   * const config = ConfigBuilder.fromEnv({ timeout: 60000 });
   * ```
   */
  static fromEnv(overrides?: Partial<KraConfig>): Required<KraConfig> {
    // Get API key
    const apiKey = overrides?.apiKey || process.env.KRA_API_KEY;
    if (!apiKey) {
      throw new Error(
        'API key is required. Set KRA_API_KEY environment variable or pass apiKey parameter.'
      );
    }

    // Get base URL
    const baseUrl =
      overrides?.baseUrl ||
      process.env.KRA_API_BASE_URL ||
      'https://api.kra.go.ke/gavaconnect/v1';

    // Get timeout
    const timeout = overrides?.timeout || parseInt(process.env.KRA_TIMEOUT || '30000', 10);

    // Get verify SSL
    const verifySsl =
      overrides?.verifySsl !== undefined
        ? overrides.verifySsl
        : process.env.KRA_VERIFY_SSL !== 'false';

    // Retry configuration
    const retryConfig: Required<RetryConfig> = {
      maxAttempts:
        overrides?.retryConfig?.maxAttempts ||
        parseInt(process.env.KRA_MAX_RETRIES || '3', 10),
      initialDelay: overrides?.retryConfig?.initialDelay || DEFAULT_RETRY_CONFIG.initialDelay,
      maxDelay: overrides?.retryConfig?.maxDelay || DEFAULT_RETRY_CONFIG.maxDelay,
      exponentialBase:
        overrides?.retryConfig?.exponentialBase || DEFAULT_RETRY_CONFIG.exponentialBase,
      retryOnTimeout:
        overrides?.retryConfig?.retryOnTimeout !== undefined
          ? overrides.retryConfig.retryOnTimeout
          : process.env.KRA_RETRY_ON_TIMEOUT !== 'false',
      retryOnRateLimit:
        overrides?.retryConfig?.retryOnRateLimit !== undefined
          ? overrides.retryConfig.retryOnRateLimit
          : process.env.KRA_RETRY_ON_RATE_LIMIT !== 'false',
    };

    // Cache configuration
    const cacheConfig: Required<CacheConfig> = {
      enabled:
        overrides?.cacheConfig?.enabled !== undefined
          ? overrides.cacheConfig.enabled
          : process.env.KRA_CACHE_ENABLED !== 'false',
      ttl:
        overrides?.cacheConfig?.ttl || parseInt(process.env.KRA_CACHE_TTL || '3600', 10),
      maxSize:
        overrides?.cacheConfig?.maxSize ||
        parseInt(process.env.KRA_CACHE_MAX_SIZE || '1000', 10),
    };

    // Rate limit configuration
    const rateLimitConfig: Required<RateLimitConfig> = {
      maxRequests:
        overrides?.rateLimitConfig?.maxRequests ||
        parseInt(process.env.KRA_RATE_LIMIT_MAX_REQUESTS || '100', 10),
      windowSeconds:
        overrides?.rateLimitConfig?.windowSeconds ||
        parseInt(process.env.KRA_RATE_LIMIT_WINDOW_SECONDS || '60', 10),
      enabled:
        overrides?.rateLimitConfig?.enabled !== undefined
          ? overrides.rateLimitConfig.enabled
          : process.env.KRA_RATE_LIMIT_ENABLED !== 'false',
    };

    // User agent
    const userAgent = overrides?.userAgent || 'kra-connect-node/0.1.0';

    const config: Required<KraConfig> = {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout,
      verifySsl,
      retryConfig,
      cacheConfig,
      rateLimitConfig,
      userAgent,
    };

    // Validate configuration
    this.validate(config);

    return config;
  }

  /**
   * Validate configuration values.
   *
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  private static validate(config: Required<KraConfig>): void {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    if (config.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }

    if (config.retryConfig.maxAttempts < 1) {
      throw new Error('maxAttempts must be at least 1');
    }

    if (config.retryConfig.initialDelay <= 0) {
      throw new Error('initialDelay must be positive');
    }

    if (config.retryConfig.maxDelay < config.retryConfig.initialDelay) {
      throw new Error('maxDelay must be greater than or equal to initialDelay');
    }

    if (config.retryConfig.exponentialBase <= 1) {
      throw new Error('exponentialBase must be greater than 1');
    }

    if (config.cacheConfig.ttl <= 0) {
      throw new Error('Cache TTL must be positive');
    }

    if (config.cacheConfig.maxSize <= 0) {
      throw new Error('Cache maxSize must be positive');
    }

    if (config.rateLimitConfig.maxRequests <= 0) {
      throw new Error('Rate limit maxRequests must be positive');
    }

    if (config.rateLimitConfig.windowSeconds <= 0) {
      throw new Error('Rate limit windowSeconds must be positive');
    }
  }

  /**
   * Get HTTP headers for API requests.
   *
   * @param config - Configuration object
   * @returns HTTP headers
   *
   * @example
   * ```typescript
   * const headers = ConfigBuilder.getHeaders(config);
   * console.log(headers['Authorization']); // Bearer api-key-here
   * ```
   */
  static getHeaders(config: KraConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': config.userAgent || 'kra-connect-node/0.1.0',
    };
  }

  /**
   * Calculate delay for retry attempt.
   *
   * Uses exponential backoff with jitter to prevent thundering herd.
   *
   * @param config - Retry configuration
   * @param attempt - Attempt number (0-indexed)
   * @returns Delay in milliseconds
   *
   * @example
   * ```typescript
   * const delay = ConfigBuilder.getRetryDelay(retryConfig, 0); // First retry
   * await new Promise(resolve => setTimeout(resolve, delay));
   * ```
   */
  static getRetryDelay(config: Required<RetryConfig>, attempt: number): number {
    const delay = Math.min(
      config.initialDelay * Math.pow(config.exponentialBase, attempt),
      config.maxDelay
    );

    // Add jitter (±25% of delay)
    const jitter = delay * 0.25 * (2 * Math.random() - 1);

    return Math.max(0, delay + jitter);
  }
}

/**
 * Create a default configuration with the given API key.
 *
 * @param apiKey - KRA API key
 * @returns Configuration object with defaults
 *
 * @example
 * ```typescript
 * const config = createDefaultConfig('your-api-key');
 * const client = new KraClient(config);
 * ```
 */
export function createDefaultConfig(apiKey: string): Required<KraConfig> {
  return {
    apiKey,
    baseUrl: 'https://api.kra.go.ke/gavaconnect/v1',
    timeout: 30000,
    verifySsl: true,
    retryConfig: DEFAULT_RETRY_CONFIG,
    cacheConfig: DEFAULT_CACHE_CONFIG,
    rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
    userAgent: 'kra-connect-node/0.1.0',
  };
}

/**
 * Merge user configuration with defaults.
 *
 * @param userConfig - User-provided configuration
 * @returns Merged configuration with defaults
 *
 * @example
 * ```typescript
 * const config = mergeConfig({ apiKey: 'test', timeout: 60000 });
 * ```
 */
export function mergeConfig(userConfig: KraConfig): Required<KraConfig> {
  const defaults = createDefaultConfig(userConfig.apiKey);

  return {
    ...defaults,
    ...userConfig,
    retryConfig: { ...defaults.retryConfig, ...userConfig.retryConfig },
    cacheConfig: { ...defaults.cacheConfig, ...userConfig.cacheConfig },
    rateLimitConfig: { ...defaults.rateLimitConfig, ...userConfig.rateLimitConfig },
  };
}
