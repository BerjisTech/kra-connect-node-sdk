/**
 * @file types.ts
 * @description Type definitions for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

/**
 * Enumeration of possible taxpayer statuses
 */
export enum TaxpayerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DORMANT = 'dormant',
}

/**
 * Enumeration of tax obligation statuses
 */
export enum ObligationStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PENDING = 'pending',
  OVERDUE = 'overdue',
}

/**
 * PIN verification result
 */
export interface PinVerificationResult {
  /** The verified PIN number */
  pinNumber: string;
  /** Whether the PIN is valid and active */
  isValid: boolean;
  /** Full name or business name of the taxpayer */
  taxpayerName?: string;
  /** Current status of the taxpayer */
  status?: TaxpayerStatus;
  /** Date when the PIN was registered */
  registrationDate?: string;
  /** Type of business (individual, company, etc.) */
  businessType?: string;
  /** Taxpayer's postal address */
  postalAddress?: string;
  /** Taxpayer's physical address */
  physicalAddress?: string;
  /** Contact email address */
  email?: string;
  /** Contact phone number */
  phoneNumber?: string;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Verification timestamp */
  verifiedAt: string;
}

/**
 * TCC verification result
 */
export interface TccVerificationResult {
  /** The TCC number */
  tccNumber: string;
  /** Whether the TCC is currently valid */
  isValid: boolean;
  /** Associated taxpayer PIN */
  pinNumber?: string;
  /** Name of the taxpayer */
  taxpayerName?: string;
  /** Date when TCC was issued */
  issueDate?: string;
  /** Date when TCC expires */
  expiryDate?: string;
  /** Type of TCC (standard, special, etc.) */
  certificateType?: string;
  /** Current status of the certificate */
  status?: string;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Verification timestamp */
  verifiedAt: string;
}

/**
 * E-slip validation result
 */
export interface EslipValidationResult {
  /** The e-slip number */
  slipNumber: string;
  /** Whether the slip is valid */
  isValid: boolean;
  /** Associated taxpayer PIN */
  pinNumber?: string;
  /** Payment amount */
  amount?: number;
  /** Date of payment */
  paymentDate?: string;
  /** Payment reference number */
  paymentReference?: string;
  /** Type of tax obligation */
  obligationType?: string;
  /** Tax period for the payment */
  taxPeriod?: string;
  /** Payment status */
  status?: string;
  /** Error message if validation failed */
  errorMessage?: string;
  /** Validation timestamp */
  validatedAt: string;
}

/**
 * NIL return filing request
 */
export interface NilReturnRequest {
  /** Taxpayer's PIN */
  pinNumber: string;
  /** Tax period in YYYYMM format */
  period: string;
  /** Obligation identifier */
  obligationId: string;
}

/**
 * NIL return filing result
 */
export interface NilReturnResult {
  /** Taxpayer PIN */
  pinNumber: string;
  /** Tax period (YYYYMM format) */
  period: string;
  /** Obligation identifier */
  obligationId: string;
  /** Submission reference number */
  submissionReference?: string;
  /** Date of submission */
  submissionDate?: string;
  /** Whether filing was successful */
  isSuccessful: boolean;
  /** Acknowledgement receipt number */
  acknowledgementReceipt?: string;
  /** Error message if filing failed */
  errorMessage?: string;
}

/**
 * Tax obligation information
 */
export interface TaxObligation {
  /** Unique obligation identifier */
  obligationId: string;
  /** Type of tax obligation (VAT, PAYE, etc.) */
  obligationType: string;
  /** Description of the obligation */
  description: string;
  /** Filing frequency (monthly, quarterly, etc.) */
  frequency: string;
  /** Compliance status */
  status: ObligationStatus;
  /** Next filing due date */
  dueDate?: string;
  /** Date of last filing */
  lastFiled?: string;
}

/**
 * Comprehensive taxpayer information
 */
export interface TaxpayerDetails {
  /** KRA PIN number */
  pinNumber: string;
  /** Full name or business name */
  taxpayerName: string;
  /** Registered business name */
  businessName?: string;
  /** PIN registration date */
  registrationDate?: string;
  /** Taxpayer status */
  status: TaxpayerStatus;
  /** Type of business */
  businessType?: string;
  /** Postal address */
  postalAddress?: string;
  /** Physical address */
  physicalAddress?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phoneNumber?: string;
  /** List of tax obligations */
  taxObligations: TaxObligation[];
  /** Overall compliance status */
  complianceStatus?: ObligationStatus;
  /** Tax Compliance Certificate status */
  tccStatus?: string;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelay?: number;
  /** Base for exponential backoff calculation (default: 2) */
  exponentialBase?: number;
  /** Whether to retry on timeout errors (default: true) */
  retryOnTimeout?: boolean;
  /** Whether to retry on rate limit errors (default: true) */
  retryOnRateLimit?: boolean;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Whether caching is enabled (default: true) */
  enabled?: boolean;
  /** Time-to-live in seconds for cached entries (default: 3600) */
  ttl?: number;
  /** Maximum number of cached entries (default: 1000) */
  maxSize?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the time window (default: 100) */
  maxRequests?: number;
  /** Time window in seconds (default: 60) */
  windowSeconds?: number;
  /** Whether rate limiting is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Main SDK configuration
 */
export interface KraConfig {
  /** KRA API key (required) */
  apiKey: string;
  /** Base URL for KRA API (default: https://api.kra.go.ke/gavaconnect/v1) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to verify SSL certificates (default: true) */
  verifySsl?: boolean;
  /** Configuration for retry behavior */
  retryConfig?: RetryConfig;
  /** Configuration for caching */
  cacheConfig?: CacheConfig;
  /** Configuration for rate limiting */
  rateLimitConfig?: RateLimitConfig;
  /** Custom user agent string */
  userAgent?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Additional error details */
  details?: Record<string, any>;
}
