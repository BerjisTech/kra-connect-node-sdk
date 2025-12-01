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
import { TaxpayerStatus, ObligationStatus } from './types';
import { HttpClient } from './http-client';
import { CacheManager } from './cache';
import { TokenBucketRateLimiter } from './rate-limiter';
import { mergeConfig, NormalizedKraConfig } from './config';
import {
  validatePinFormat,
  validateTccFormat,
  validateEslipNumber,
  maskPin,
} from './validators';
import { KraConnectError, ValidationError } from './exceptions';

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
  private readonly config: NormalizedKraConfig;
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
      const envelope = await this.httpClient.post<Record<string, any>>('/checker/v1/pinbypin', {
        KRAPIN: normalizedPin,
      });
      const data = envelope.data;

      const statusValue =
        (data.pinStatus || data.status || TaxpayerStatus.INACTIVE)?.toString().toLowerCase() as TaxpayerStatus;

      const result: PinVerificationResult = {
        pinNumber: data.kraPin || normalizedPin,
        isValid: data.isValid ?? data.valid ?? false,
        taxpayerName: data.taxpayerName || data.taxpayer_name,
        status: statusValue,
        registrationDate: data.registrationDate || data.registration_date,
        businessType: data.taxpayerType || data.business_type,
        postalAddress: data.postalAddress || data.postal_address,
        physicalAddress: data.physicalAddress || data.physical_address,
        email: data.emailAddress || data.email,
        phoneNumber: data.phoneNumber || data.phone_number,
        verifiedAt: new Date().toISOString(),
        metadata: envelope.metadata,
        rawData: envelope.raw,
        additionalData: data,
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
   * @param kraPin - Taxpayer PIN associated with the TCC
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
  async verifyTcc(tccNumber: string, kraPin?: string): Promise<TccVerificationResult> {
    // Validate TCC format
    const normalizedTcc = validateTccFormat(tccNumber);
    if (!kraPin) {
      throw new ValidationError('pin', 'Taxpayer PIN is required to verify a TCC');
    }
    const normalizedPin = validatePinFormat(kraPin);

    console.log(`Verifying TCC: ${normalizedTcc}`);

    // Generate cache key
    const cacheKey = this.cacheManager.generateKey('tcc', {
      tccNumber: normalizedTcc,
      pinNumber: normalizedPin,
    });

    // Try to get from cache
    const cached = this.cacheManager.get<TccVerificationResult>(cacheKey);
    if (cached) {
      console.log(`Returning cached result for TCC: ${normalizedTcc}`);
      return cached;
    }

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      const envelope = await this.httpClient.post<Record<string, any>>('/v1/kra-tcc/validate', {
        kraPIN: normalizedPin,
        tccNumber: normalizedTcc,
      });
      const data = envelope.data;

      const result: TccVerificationResult = {
        tccNumber: normalizedTcc,
        isValid: data.isValid ?? data.valid ?? false,
        pinNumber: data.kraPin || data.pin_number || normalizedPin,
        taxpayerName: data.taxpayerName || data.taxpayer_name,
        issueDate: data.issueDate || data.issue_date,
        expiryDate: data.expiryDate || data.expiry_date,
        certificateType: data.certificateType || data.certificate_type,
        status: data.status || data.tccStatus,
        verifiedAt: new Date().toISOString(),
        metadata: envelope.metadata,
        rawData: envelope.raw,
        additionalData: data,
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
      const envelope = await this.httpClient.post<Record<string, any>>('/payment/checker/v1/eslip', {
        EslipNumber: normalizedSlip,
      });
      const data = envelope.data;

      const result: EslipValidationResult = {
        slipNumber: data.EslipNumber || normalizedSlip,
        isValid: data.isValid ?? data.valid ?? false,
        pinNumber: data.taxpayerPin || data.pin_number,
        amount: data.amount,
        paymentDate: data.paymentDate || data.payment_date,
        paymentReference: data.paymentReference || data.payment_reference,
        obligationType: data.obligationType || data.obligation_type,
        taxPeriod: data.obligationPeriod || data.tax_period,
        status: data.status,
        validatedAt: new Date().toISOString(),
        metadata: envelope.metadata,
        rawData: envelope.raw,
        additionalData: data,
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
    if (request.obligationCode <= 0) {
      throw new ValidationError('obligationCode', 'Obligation code must be a positive integer');
    }
    if (request.month < 1 || request.month > 12) {
      throw new ValidationError('month', 'Month must be between 1 and 12');
    }
    if (request.year < 2000) {
      throw new ValidationError('year', 'Year must be 2000 or later');
    }

    console.log(
      `Filing NIL return for PIN: ${maskPin(normalizedPin)}, period: ${request.year}-${String(request.month).padStart(2, '0')}`
    );

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    try {
      const envelope = await this.httpClient.post<Record<string, any>>('/dtd/return/v1/nil', {
        TAXPAYERDETAILS: {
          TaxpayerPIN: normalizedPin,
          ObligationCode: request.obligationCode,
          Month: request.month,
          Year: request.year,
        },
      });
      const data = envelope.data;

      const result: NilReturnResult = {
        pinNumber: normalizedPin,
        period: `${request.year}${String(request.month).padStart(2, '0')}`,
        obligationId: request.obligationCode.toString(),
        submissionReference: data.referenceNumber || data.submission_reference,
        submissionDate: data.filingDate || data.submission_date,
        isSuccessful: data.success ?? true,
        acknowledgementReceipt: data.acknowledgementNumber || data.acknowledgement_receipt,
        errorMessage: data.errorMessage || data.error_message,
        metadata: envelope.metadata,
        rawData: envelope.raw,
        additionalData: data,
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
      const [profileEnvelope, obligationsEnvelope] = await Promise.all([
        this.httpClient.post<Record<string, any>>('/checker/v1/pinbypin', {
          KRAPIN: normalizedPin,
        }),
        this.httpClient.post<Record<string, any>>('/dtd/checker/v1/obligation', {
          taxPayerPin: normalizedPin,
        }),
      ]);

      const profile = profileEnvelope.data;
      const obligations = (obligationsEnvelope.data?.obligations || []).map((ob: Record<string, any>) => ({
        obligationId: ob.obligationId || ob.obligation_id,
        obligationType: ob.obligationType || ob.obligation_type,
        description: ob.description,
        frequency: ob.frequency,
        status: (ob.status || ObligationStatus.COMPLIANT) as ObligationStatus,
        dueDate: ob.nextFilingDate || ob.due_date,
        lastFiled: ob.lastFiled,
      }));

      const statusValue =
        (profile.pinStatus || profile.status || TaxpayerStatus.ACTIVE)?.toString().toLowerCase() as TaxpayerStatus;

      const result: TaxpayerDetails = {
        pinNumber: profile.kraPin || normalizedPin,
        taxpayerName: profile.taxpayerName || profile.taxpayer_name,
        businessName: profile.businessName || profile.business_name,
        registrationDate: profile.registrationDate || profile.registration_date,
        status: statusValue,
        businessType: profile.taxpayerType || profile.business_type,
        postalAddress: profile.postalAddress || profile.postal_address,
        physicalAddress: profile.physicalAddress || profile.physical_address,
        email: profile.emailAddress || profile.email,
        phoneNumber: profile.phoneNumber || profile.phone_number,
        taxObligations: obligations,
        complianceStatus: profile.complianceStatus || profile.compliance_status,
        tccStatus: profile.tccStatus || profile.tcc_status,
        lastUpdated: new Date().toISOString(),
        metadata: profileEnvelope.metadata,
        rawData: profileEnvelope.raw,
        additionalData: {
          profile: profileEnvelope.raw,
          obligations: obligationsEnvelope.raw,
        },
      };

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
