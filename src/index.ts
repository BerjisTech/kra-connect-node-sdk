/**
 * @file index.ts
 * @description Main entry point for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

// Main client
export { KraClient } from './client';

// Configuration
export { ConfigBuilder, createDefaultConfig, mergeConfig } from './config';
export type { KraConfig, RetryConfig, CacheConfig, RateLimitConfig } from './types';

// Types
export type {
  PinVerificationResult,
  TccVerificationResult,
  EslipValidationResult,
  NilReturnRequest,
  NilReturnResult,
  TaxpayerDetails,
  TaxObligation,
  TaxpayerStatus,
  ObligationStatus,
} from './types';

// Exceptions
export {
  KraConnectError,
  InvalidPinFormatError,
  InvalidTccFormatError,
  ApiAuthenticationError,
  ApiTimeoutError,
  RateLimitExceededError,
  ApiError,
  ValidationError,
  CacheError,
} from './exceptions';

// Validators (for advanced usage)
export {
  validatePinFormat,
  validateTccFormat,
  validatePeriodFormat,
  validateObligationId,
  validateEslipNumber,
  validateAmount,
  validateDateString,
  validateEmail,
  validatePhoneNumber,
  maskPin,
  maskSensitiveData,
} from './validators';

// Export version
export const VERSION = '0.1.0';
