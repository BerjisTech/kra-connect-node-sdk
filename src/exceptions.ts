/**
 * @file exceptions.ts
 * @description Custom exception classes for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

/**
 * Base exception for all KRA-Connect errors.
 *
 * All custom exceptions in the KRA-Connect SDK extend from this base class.
 * This allows users to catch all SDK-specific errors with a single catch clause.
 *
 * @example
 * ```typescript
 * try {
 *   await client.verifyPin('P051234567A');
 * } catch (error) {
 *   if (error instanceof KraConnectError) {
 *     console.error('SDK error:', error.message);
 *   }
 * }
 * ```
 */
export class KraConnectError extends Error {
  public readonly details?: Record<string, any>;
  public readonly statusCode?: number;

  constructor(message: string, details?: Record<string, any>, statusCode?: number) {
    super(message);
    this.name = 'KraConnectError';
    this.details = details;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Raised when a PIN number format is invalid.
 *
 * The KRA PIN format should be: P followed by 9 digits and a letter.
 * Example: P051234567A
 *
 * @example
 * ```typescript
 * if (!PIN_REGEX.test(pin)) {
 *   throw new InvalidPinFormatError(pin);
 * }
 * ```
 */
export class InvalidPinFormatError extends KraConnectError {
  constructor(pinNumber: string) {
    const message =
      `Invalid PIN format: '${pinNumber}'. ` +
      'Expected format: P followed by 9 digits and a letter (e.g., P051234567A)';
    super(message, { pinNumber });
    this.name = 'InvalidPinFormatError';
  }
}

/**
 * Raised when a TCC (Tax Compliance Certificate) number format is invalid.
 *
 * @example
 * ```typescript
 * if (!TCC_REGEX.test(tcc)) {
 *   throw new InvalidTccFormatError(tcc);
 * }
 * ```
 */
export class InvalidTccFormatError extends KraConnectError {
  constructor(tccNumber: string) {
    const message = `Invalid TCC format: '${tccNumber}'. Expected format: TCC followed by digits`;
    super(message, { tccNumber });
    this.name = 'InvalidTccFormatError';
  }
}

/**
 * Raised when API authentication fails.
 *
 * This typically occurs when:
 * - API key is missing
 * - API key is invalid or expired
 * - API key doesn't have required permissions
 *
 * @example
 * ```typescript
 * if (response.status === 401) {
 *   throw new ApiAuthenticationError('Invalid API key');
 * }
 * ```
 */
export class ApiAuthenticationError extends KraConnectError {
  constructor(message: string = 'Authentication failed') {
    super(message, undefined, 401);
    this.name = 'ApiAuthenticationError';
  }
}

/**
 * Raised when an API request times out.
 *
 * This error occurs when the KRA API doesn't respond within the
 * configured timeout period.
 *
 * @example
 * ```typescript
 * try {
 *   await client.verifyPin(pin);
 * } catch (error) {
 *   if (error instanceof ApiTimeoutError) {
 *     console.error(`Request timed out after ${error.timeout}ms`);
 *   }
 * }
 * ```
 */
export class ApiTimeoutError extends KraConnectError {
  public readonly timeout: number;
  public readonly endpoint: string;

  constructor(timeout: number, endpoint: string) {
    const message = `Request to ${endpoint} timed out after ${timeout}ms`;
    super(message, { timeout, endpoint });
    this.name = 'ApiTimeoutError';
    this.timeout = timeout;
    this.endpoint = endpoint;
  }
}

/**
 * Raised when API rate limit is exceeded.
 *
 * This error includes information about when the client can retry
 * the request.
 *
 * @example
 * ```typescript
 * try {
 *   await client.verifyPin(pin);
 * } catch (error) {
 *   if (error instanceof RateLimitExceededError) {
 *     await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
 *     // Retry the request
 *   }
 * }
 * ```
 */
export class RateLimitExceededError extends KraConnectError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    const message = `Rate limit exceeded. Retry after ${retryAfter} seconds`;
    super(message, { retryAfter }, 429);
    this.name = 'RateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Raised when an API request fails for reasons other than authentication or timeout.
 *
 * This is a generic error for API failures including:
 * - Server errors (5xx)
 * - Invalid requests (4xx other than 401/429)
 * - Network errors
 * - Unexpected responses
 *
 * @example
 * ```typescript
 * if (response.status >= 500) {
 *   throw new ApiError('Server error', response.status, response.data);
 * }
 * ```
 */
export class ApiError extends KraConnectError {
  public readonly responseData?: Record<string, any>;

  constructor(message: string, statusCode?: number, responseData?: Record<string, any>) {
    super(message, { responseData }, statusCode);
    this.name = 'ApiError';
    this.responseData = responseData;
  }
}

/**
 * Raised when input validation fails.
 *
 * Used for validating request parameters before making API calls.
 *
 * @example
 * ```typescript
 * if (!period || period.length !== 6) {
 *   throw new ValidationError('period', 'Period must be in YYYYMM format');
 * }
 * ```
 */
export class ValidationError extends KraConnectError {
  public readonly field: string;

  constructor(field: string, message: string) {
    super(`Validation error for field '${field}': ${message}`, { field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Raised when cache operations fail.
 *
 * This error is raised when the caching layer encounters issues,
 * but doesn't prevent the operation from proceeding (the SDK will
 * fall back to making a direct API call).
 *
 * @example
 * ```typescript
 * try {
 *   const cached = cache.get(key);
 * } catch (error) {
 *   if (error instanceof CacheError) {
 *     // Fall back to API call
 *     result = await apiCall();
 *   }
 * }
 * ```
 */
export class CacheError extends KraConnectError {
  public readonly operation: string;

  constructor(message: string, operation: string) {
    super(message, { operation });
    this.name = 'CacheError';
    this.operation = operation;
  }
}
