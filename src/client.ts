/**
 * @file client.ts
 * @description Main client class for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import type {
  KraConfig,
  PinVerificationResult,
  TccVerificationResult,
  EslipValidationResult,
  NilReturnRequest,
  NilReturnResult,
  TaxpayerDetails,
} from './types';
import { HttpClient } from './http-client';
import { CacheManager } from './cache';
import { TokenBucketRateLimiter } from './rate-limiter';
import { ConfigBuilder, mergeConfig } from './config';
import {
  validatePinFormat,
  validateTccFormat,
  validatePeriodFormat,
  validateObligationId,
  validateEslipNumber,
  maskPin,
} from './validators';
import { KraConnectError } from './exceptions';

/**
 * Main client for interacting with KRA GavaConnect API.
 *
 * This client provides methods for PIN verification, TCC checking,
 * NIL return filing, and other tax compliance operations.
 *
 * @example
 * ```typescript
 * import { KraClient } from '@kra-connect/node';
 *
 * const client = new KraClient({ apiKey: 'your-api-key' });
 * const result = await client.verifyPin('P051234567A');
 * console.log(`Taxpayer: ${result.taxpayerName}`);
 * ```
 *
 * Using environment variables:
 * ```typescript
 * import { KraClient, ConfigBuilder } from '@kra-connect/node';
 *
 * const config = ConfigBuilder.fromEnv();
 * const client = new KraClient(config);
 * ```
 */
export class KraClient {
  private readonly config: Required<KraConfig>;
  private readonly httpClient: HttpClient;
  private readonly cacheManager: CacheManager;
  private readonly rateLimiter: TokenBucketRateLimiter;

  /**
   * Initialize KRA client.
   *
   * @param config - Configuration object or API key string
   *
   * @example
   * ```typescript
   * // With API key only
   * const client = new KraClient({ apiKey: 'your-api-key' });
   *
   * // With full configuration
   * const client = new KraClient({
   *   apiKey: 'your-api-key',
   *   timeout: 60000,
   *   retryConfig: { maxAttempts: 5 },
   * });
   *
   * // From environment variables
   * const client = new KraClient(ConfigBuilder.fromEnv());
   * ```
   */
  constructor(config: KraConfig) {
    // Merge with defaults
    this.config = mergeConfig(config);

    // Initialize HTTP client
    this.httpClient = new HttpClient(this.config);

    // Initialize cache manager
    this.cacheManager = new CacheManager(this.config.cacheConfig);

    // Initialize rate limiter
    this.rateLimiter = new TokenBucketRateLimiter(this.config.rateLimitConfig);
  }

  /**
   * Verify a KRA PIN number.
   *
   * This method verifies if a PIN is valid and currently active in the KRA system.
   * Results are cached to improve performance and reduce API calls.
   *
   * @param pinNumber - The PIN to verify (format: P + 9 digits + letter)
   * @returns Promise resolving to verification result with taxpayer details
   * @throws InvalidPinFormatError if PIN format is invalid
   * @throws ApiAuthenticationError if API key is invalid
   * @throws ApiTimeoutError if request times out
   * @throws RateLimitExceededError if rate limit is exceeded
   * @throws ApiError for other API errors
   *
   * @example
   * ```typescript
   * const result = await client.verifyPin('P051234567A');
   * if (result.isValid) {
   *   console.log(`Valid PIN: ${result.taxpayerName}`);
   *   console.log(`Status: ${result.status}`);
   * } else {
   *   console.log(`Invalid PIN: ${result.errorMessage}`);
   * }
   * ```
   */
  async verifyPin(pinNumber: string): Promise<PinVerificationResult> {
    // Validate PIN format
    const normalizedPin = validatePinFormat(pinNumber);

    console.log(`Verifying PIN: ${maskPin(normalizedPin)}`);

    // Generate cache key
    const cacheKey = this.cacheManager.generateKey('pin', { pinNumber: normalizedPin });

    // Try to get from cache
    const cached = this.cacheManager.get<PinVerificationResult>(cacheKey);
    if (cached) {
      console.log(`Returning cached result for PIN: ${maskPin(normalizedPin)}`);
      return cached;
    }

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      // Make API request
      const responseData = await this.httpClient.post('/verify-pin', { pin: normalizedPin });

      // Parse response into result
      const result: PinVerificationResult = {
        pinNumber: normalizedPin,
        isValid: responseData.valid ?? false,
        taxpayerName: responseData.taxpayer_name,
        status: responseData.status,
        registrationDate: responseData.registration_date,
        businessType: responseData.business_type,
        postalAddress: responseData.postal_address,
        physicalAddress: responseData.physical_address,
        email: responseData.email,
        phoneNumber: responseData.phone_number,
        verifiedAt: new Date().toISOString(),
      };

      // Cache the result
      this.cacheManager.set(cacheKey, result);

      console.log(`PIN verification completed: ${maskPin(normalizedPin)}`);
      return result;
    } catch (error) {
      if (error instanceof KraConnectError) {
        throw error;
      }
      throw new KraConnectError(`PIN verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify a Tax Compliance Certificate (TCC).
   *
   * This method checks if a TCC number is valid and currently active.
   *
   * @param tccNumber - The TCC number to verify
   * @returns Promise resolving to TCC verification result
   * @throws InvalidTccFormatError if TCC format is invalid
   * @throws ApiError for API errors
   *
   * @example
   * ```typescript
   * const result = await client.verifyTcc('TCC123456');
   * if (result.isValid) {
   *   console.log(`TCC valid until: ${result.expiryDate}`);
   *   console.log(`Taxpayer: ${result.taxpayerName}`);
   * } else {
   *   console.log(`Invalid TCC: ${result.errorMessage}`);
   * }
   * ```
   */
  async verifyTcc(tccNumber: string): Promise<TccVerificationResult> {
    // Validate TCC format
    const normalizedTcc = validateTccFormat(tccNumber);

    console.log(`Verifying TCC: ${normalizedTcc}`);

    // Generate cache key
    const cacheKey = this.cacheManager.generateKey('tcc', { tccNumber: normalizedTcc });

    // Try to get from cache
    const cached = this.cacheManager.get<TccVerificationResult>(cacheKey);
    if (cached) {
      console.log(`Returning cached result for TCC: ${normalizedTcc}`);
      return cached;
    }

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      // Make API request
      const responseData = await this.httpClient.post('/verify-tcc', { tcc: normalizedTcc });

      // Parse response
      const result: TccVerificationResult = {
        tccNumber: normalizedTcc,
        isValid: responseData.valid ?? false,
        pinNumber: responseData.pin_number,
        taxpayerName: responseData.taxpayer_name,
        issueDate: responseData.issue_date,
        expiryDate: responseData.expiry_date,
        certificateType: responseData.certificate_type,
        status: responseData.status,
        verifiedAt: new Date().toISOString(),
      };

      // Cache the result
      this.cacheManager.set(cacheKey, result);

      console.log(`TCC verification completed: ${normalizedTcc}`);
      return result;
    } catch (error) {
      if (error instanceof KraConnectError) {
        throw error;
      }
      throw new KraConnectError(`TCC verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate an electronic payment slip.
   *
   * @param slipNumber - The e-slip number to validate
   * @returns Promise resolving to validation result
   * @throws ValidationError if slip number format is invalid
   * @throws ApiError for API errors
   *
   * @example
   * ```typescript
   * const result = await client.validateEslip('ESLIP123456789');
   * if (result.isValid) {
   *   console.log(`Payment amount: ${result.amount}`);
   *   console.log(`Payment date: ${result.paymentDate}`);
   * }
   * ```
   */
  async validateEslip(slipNumber: string): Promise<EslipValidationResult> {
    // Validate slip number
    const normalizedSlip = validateEslipNumber(slipNumber);

    console.log(`Validating e-slip: ${normalizedSlip}`);

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      // Make API request
      const responseData = await this.httpClient.post('/validate-eslip', {
        slip_number: normalizedSlip,
      });

      // Parse response
      const result: EslipValidationResult = {
        slipNumber: normalizedSlip,
        isValid: responseData.valid ?? false,
        pinNumber: responseData.pin_number,
        amount: responseData.amount,
        paymentDate: responseData.payment_date,
        paymentReference: responseData.payment_reference,
        obligationType: responseData.obligation_type,
        taxPeriod: responseData.tax_period,
        status: responseData.status,
        validatedAt: new Date().toISOString(),
      };

      console.log(`E-slip validation completed: ${normalizedSlip}`);
      return result;
    } catch (error) {
      if (error instanceof KraConnectError) {
        throw error;
      }
      throw new KraConnectError(`E-slip validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * File a NIL return for a taxpayer.
   *
   * @param request - NIL return filing request
   * @returns Promise resolving to filing result
   * @throws InvalidPinFormatError if PIN format is invalid
   * @throws ValidationError if period or obligation_id format is invalid
   * @throws ApiError for API errors
   *
   * @example
   * ```typescript
   * const result = await client.fileNilReturn({
   *   pinNumber: 'P051234567A',
   *   period: '202401',
   *   obligationId: 'OBL123456',
   * });
   * if (result.isSuccessful) {
   *   console.log('NIL return filed successfully');
   *   console.log(`Reference: ${result.submissionReference}`);
   * }
   * ```
   */
  async fileNilReturn(request: NilReturnRequest): Promise<NilReturnResult> {
    // Validate inputs
    const normalizedPin = validatePinFormat(request.pinNumber);
    const validatedPeriod = validatePeriodFormat(request.period);
    const validatedObligationId = validateObligationId(request.obligationId);

    console.log(`Filing NIL return for PIN: ${maskPin(normalizedPin)}, period: ${validatedPeriod}`);

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      // Make API request
      const responseData = await this.httpClient.post('/file-nil-return', {
        pin: normalizedPin,
        period: validatedPeriod,
        obligation_id: validatedObligationId,
      });

      // Parse response
      const result: NilReturnResult = {
        pinNumber: normalizedPin,
        period: validatedPeriod,
        obligationId: validatedObligationId,
        submissionReference: responseData.submission_reference,
        submissionDate: responseData.submission_date,
        isSuccessful: responseData.success ?? false,
        acknowledgementReceipt: responseData.acknowledgement_receipt,
      };

      console.log(`NIL return filing completed for PIN: ${maskPin(normalizedPin)}`);
      return result;
    } catch (error) {
      if (error instanceof KraConnectError) {
        throw error;
      }
      throw new KraConnectError(`NIL return filing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve detailed taxpayer information.
   *
   * @param pinNumber - Taxpayer's PIN
   * @returns Promise resolving to comprehensive taxpayer information
   * @throws InvalidPinFormatError if PIN format is invalid
   * @throws ApiError for API errors
   *
   * @example
   * ```typescript
   * const details = await client.getTaxpayerDetails('P051234567A');
   * console.log(`Business: ${details.businessName}`);
   * console.log(`Status: ${details.status}`);
   * details.taxObligations.forEach(obligation => {
   *   console.log(`Obligation: ${obligation.obligationType}`);
   * });
   * ```
   */
  async getTaxpayerDetails(pinNumber: string): Promise<TaxpayerDetails> {
    // Validate PIN format
    const normalizedPin = validatePinFormat(pinNumber);

    console.log(`Retrieving taxpayer details for PIN: ${maskPin(normalizedPin)}`);

    // Generate cache key
    const cacheKey = this.cacheManager.generateKey('taxpayer', { pinNumber: normalizedPin });

    // Try to get from cache (shorter TTL for taxpayer details)
    const cached = this.cacheManager.get<TaxpayerDetails>(cacheKey);
    if (cached) {
      console.log(`Returning cached taxpayer details for PIN: ${maskPin(normalizedPin)}`);
      return cached;
    }

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      // Make API request
      const responseData = await this.httpClient.get(`/taxpayer-details/${normalizedPin}`);

      // Parse response
      const result: TaxpayerDetails = {
        pinNumber: responseData.pin_number || normalizedPin,
        taxpayerName: responseData.taxpayer_name,
        businessName: responseData.business_name,
        registrationDate: responseData.registration_date,
        status: responseData.status,
        businessType: responseData.business_type,
        postalAddress: responseData.postal_address,
        physicalAddress: responseData.physical_address,
        email: responseData.email,
        phoneNumber: responseData.phone_number,
        taxObligations: responseData.tax_obligations || [],
        complianceStatus: responseData.compliance_status,
        tccStatus: responseData.tcc_status,
        lastUpdated: new Date().toISOString(),
      };

      // Cache the result with shorter TTL (30 minutes)
      this.cacheManager.set(cacheKey, result, 1800);

      console.log(`Taxpayer details retrieved for PIN: ${maskPin(normalizedPin)}`);
      return result;
    } catch (error) {
      if (error instanceof KraConnectError) {
        throw error;
      }
      throw new KraConnectError(`Failed to retrieve taxpayer details: ${(error as Error).message}`);
    }
  }

  /**
   * Verify multiple PINs in batch.
   *
   * This method verifies multiple PINs concurrently using Promise.all.
   *
   * @param pinNumbers - Array of PIN numbers to verify
   * @returns Promise resolving to array of verification results
   *
   * @example
   * ```typescript
   * const pins = ['P051234567A', 'P051234567B', 'P051234567C'];
   * const results = await client.verifyPinsBatch(pins);
   * results.forEach(result => {
   *   console.log(`${result.pinNumber}: ${result.isValid ? '✓' : '✗'}`);
   * });
   * ```
   */
  async verifyPinsBatch(pinNumbers: string[]): Promise<PinVerificationResult[]> {
    console.log(`Batch verifying ${pinNumbers.length} PINs`);

    const promises = pinNumbers.map(async (pin) => {
      try {
        return await this.verifyPin(pin);
      } catch (error) {
        console.error(`Error verifying PIN ${maskPin(pin)}: ${error}`);
        // Return error result
        return {
          pinNumber: pin,
          isValid: false,
          errorMessage: (error as Error).message,
          verifiedAt: new Date().toISOString(),
        };
      }
    });

    const results = await Promise.all(promises);

    console.log(`Batch verification completed: ${results.length} results`);
    return results;
  }

  /**
   * Clear the cache.
   *
   * Removes all cached responses.
   *
   * @example
   * ```typescript
   * client.clearCache();
   * ```
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * Reset the rate limiter.
   *
   * Resets the rate limiter to allow immediate requests.
   *
   * @example
   * ```typescript
   * client.resetRateLimiter();
   * ```
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}
