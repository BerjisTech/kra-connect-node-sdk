/**
 * @file cache.ts
 * @description Caching implementation for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import crypto from 'crypto';
import type { CacheConfig } from './types';
import { CacheError } from './exceptions';

/**
 * Abstract base class for cache backends.
 *
 * Allows for different cache implementations (in-memory, Redis, etc.).
 */
export abstract class CacheBackend {
  /**
   * Retrieve value from cache.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  abstract get<T = any>(key: string): T | null;

  /**
   * Store value in cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time-to-live in seconds
   */
  abstract set<T = any>(key: string, value: T, ttl: number): void;

  /**
   * Delete value from cache.
   *
   * @param key - Cache key
   */
  abstract delete(key: string): void;

  /**
   * Clear all cached values.
   */
  abstract clear(): void;
}

/**
 * Cache entry with expiration time.
 */
interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache backend using Map.
 *
 * Simple and fast cache implementation that stores data in memory.
 * Data is lost when the process terminates.
 *
 * @example
 * ```typescript
 * const cache = new MemoryCacheBackend(1000, 3600);
 * cache.set('key', 'value', 3600);
 * const value = cache.get('key'); // 'value'
 * ```
 */
export class MemoryCacheBackend extends CacheBackend {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  /**
   * Initialize memory cache backend.
   *
   * @param maxSize - Maximum number of items to cache
   * @param defaultTtl - Default time-to-live in seconds
   */
  constructor(maxSize: number = 1000, defaultTtl: number = 3600) {
    super();
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Retrieve value from cache.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found or expired
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Store value in cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time-to-live in seconds
   */
  set<T = any>(key: string, value: T, ttl: number = this.defaultTtl): void {
    // Enforce max size by removing oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache.
   *
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   *
   * @returns Object with cache size and capacity
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Cache manager for API responses.
 *
 * Provides a high-level interface for caching with automatic key generation.
 *
 * @example
 * ```typescript
 * const config = { enabled: true, ttl: 3600, maxSize: 1000 };
 * const cacheManager = new CacheManager(config);
 * const result = await cacheManager.getOrSet('pin:P051234567A', () => apiCall());
 * ```
 */
export class CacheManager {
  private readonly config: Required<CacheConfig>;
  private readonly backend: CacheBackend;
  private readonly enabled: boolean;

  /**
   * Initialize cache manager.
   *
   * @param config - Cache configuration
   *
   * @example
   * ```typescript
   * const config = { enabled: true, ttl: 3600, maxSize: 1000 };
   * const cacheManager = new CacheManager(config);
   * ```
   */
  constructor(config: CacheConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 3600,
      maxSize: config.maxSize ?? 1000,
    };

    this.enabled = this.config.enabled;
    this.backend = new MemoryCacheBackend(this.config.maxSize, this.config.ttl);
  }

  /**
   * Generate a cache key from prefix and parameters.
   *
   * @param prefix - Key prefix (e.g., "pin", "tcc")
   * @param params - Additional parameters to include in key
   * @returns Generated cache key
   *
   * @example
   * ```typescript
   * const key = cacheManager.generateKey('pin', { pinNumber: 'P051234567A' });
   * // Returns: 'pin:a1b2c3d4...'
   * ```
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    // Create a deterministic string from params
    const paramString = JSON.stringify(params, Object.keys(params).sort());

    // Generate hash
    const hash = crypto.createHash('md5').update(paramString).digest('hex');

    return `${prefix}:${hash}`;
  }

  /**
   * Retrieve value from cache.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found or cache disabled
   *
   * @example
   * ```typescript
   * const value = cacheManager.get('pin:a1b2c3d4');
   * ```
   */
  get<T = any>(key: string): T | null {
    if (!this.enabled) {
      return null;
    }

    try {
      return this.backend.get<T>(key);
    } catch (error) {
      console.warn(`Cache error: ${error}`);
      return null;
    }
  }

  /**
   * Store value in cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional time-to-live in seconds (uses config default if not provided)
   *
   * @example
   * ```typescript
   * cacheManager.set('pin:a1b2c3d4', result, 3600);
   * ```
   */
  set<T = any>(key: string, value: T, ttl?: number): void {
    if (!this.enabled) {
      return;
    }

    const finalTtl = ttl ?? this.config.ttl;

    try {
      this.backend.set(key, value, finalTtl);
    } catch (error) {
      console.warn(`Cache error: ${error}`);
    }
  }

  /**
   * Delete value from cache.
   *
   * @param key - Cache key
   *
   * @example
   * ```typescript
   * cacheManager.delete('pin:a1b2c3d4');
   * ```
   */
  delete(key: string): void {
    if (!this.enabled) {
      return;
    }

    try {
      this.backend.delete(key);
    } catch (error) {
      console.warn(`Error deleting from cache: ${error}`);
    }
  }

  /**
   * Clear all cached values.
   *
   * @example
   * ```typescript
   * cacheManager.clear();
   * ```
   */
  clear(): void {
    if (!this.enabled) {
      return;
    }

    try {
      this.backend.clear();
    } catch (error) {
      console.warn(`Error clearing cache: ${error}`);
    }
  }

  /**
   * Get value from cache or compute and store it.
   *
   * This is a convenience method that retrieves from cache if available,
   * otherwise calls the factory function to compute the value and stores it.
   *
   * @param key - Cache key
   * @param factoryFn - Function to call if cache miss (should return value to cache)
   * @param ttl - Optional time-to-live in seconds
   * @returns Cached or computed value
   *
   * @example
   * ```typescript
   * const result = await cacheManager.getOrSet(
   *   'pin:P051234567A',
   *   async () => await apiClient.verifyPin('P051234567A')
   * );
   * ```
   */
  async getOrSet<T = any>(
    key: string,
    factoryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Cache miss - compute value
    const value = await factoryFn();

    // Store in cache
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Invalidate all cache keys matching a pattern.
   *
   * Note: This is a simple implementation for in-memory cache.
   * For Redis or other backends, you would need pattern-based deletion.
   *
   * @param pattern - Key pattern to match (e.g., "pin:*")
   *
   * @example
   * ```typescript
   * cacheManager.invalidatePattern('pin:*');
   * ```
   */
  invalidatePattern(pattern: string): void {
    if (!this.enabled) {
      return;
    }

    if (this.backend instanceof MemoryCacheBackend) {
      // For memory cache, we need to iterate and delete
      const regex = new RegExp(pattern.replace('*', '.*'));
      const cache = (this.backend as any).cache as Map<string, any>;

      const keysToDelete: string[] = [];
      for (const key of cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.delete(key));
    }
  }
}
