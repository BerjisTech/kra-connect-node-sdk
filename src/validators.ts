/**
 * @file validators.ts
 * @description Input validation functions for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import { InvalidPinFormatError, InvalidTccFormatError, ValidationError } from './exceptions';

// Regex patterns for validation
const PIN_REGEX = /^P\d{9}[A-Z]$/;
const TCC_REGEX = /^TCC\d+$/;
const PERIOD_REGEX = /^\d{6}$/; // YYYYMM format
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const KENYAN_PHONE_REGEX = /^\+254[17]\d{8}$/;

/**
 * Validate KRA PIN number format.
 *
 * The KRA PIN format is: P followed by 9 digits and a letter.
 * Example: P051234567A
 *
 * @param pinNumber - The PIN number to validate
 * @returns Normalized PIN number (uppercase, stripped of whitespace)
 * @throws InvalidPinFormatError if PIN format is invalid
 *
 * @example
 * ```typescript
 * const pin = validatePinFormat('P051234567A'); // 'P051234567A'
 * const normalized = validatePinFormat('p051234567a'); // 'P051234567A'
 * ```
 */
export function validatePinFormat(pinNumber: string): string {
  if (!pinNumber) {
    throw new InvalidPinFormatError('PIN number is required');
  }

  // Normalize: strip whitespace and convert to uppercase
  const normalized = pinNumber.trim().toUpperCase();

  // Validate format
  if (!PIN_REGEX.test(normalized)) {
    throw new InvalidPinFormatError(normalized);
  }

  return normalized;
}

/**
 * Validate Tax Compliance Certificate (TCC) number format.
 *
 * The TCC format is: TCC followed by digits.
 * Example: TCC123456
 *
 * @param tccNumber - The TCC number to validate
 * @returns Normalized TCC number (uppercase, stripped of whitespace)
 * @throws InvalidTccFormatError if TCC format is invalid
 *
 * @example
 * ```typescript
 * const tcc = validateTccFormat('TCC123456'); // 'TCC123456'
 * const normalized = validateTccFormat('tcc123456'); // 'TCC123456'
 * ```
 */
export function validateTccFormat(tccNumber: string): string {
  if (!tccNumber) {
    throw new InvalidTccFormatError('TCC number is required');
  }

  // Normalize: strip whitespace and convert to uppercase
  const normalized = tccNumber.trim().toUpperCase();

  // Validate format
  if (!TCC_REGEX.test(normalized)) {
    throw new InvalidTccFormatError(normalized);
  }

  return normalized;
}

/**
 * Validate tax period format.
 *
 * The period format is: YYYYMM (year and month).
 * Example: 202401 for January 2024
 *
 * @param period - The period string to validate
 * @returns Validated period string
 * @throws ValidationError if period format is invalid
 *
 * @example
 * ```typescript
 * const period = validatePeriodFormat('202401'); // '202401'
 * validatePeriodFormat('2024-01'); // Throws ValidationError
 * ```
 */
export function validatePeriodFormat(period: string): string {
  if (!period) {
    throw new ValidationError('period', 'Period is required');
  }

  // Remove any whitespace
  const trimmed = period.trim();

  // Check basic format
  if (!PERIOD_REGEX.test(trimmed)) {
    throw new ValidationError(
      'period',
      'Period must be in YYYYMM format (e.g., 202401 for January 2024)'
    );
  }

  // Validate year and month
  const year = parseInt(trimmed.substring(0, 4), 10);
  const month = parseInt(trimmed.substring(4, 6), 10);

  if (year < 2000 || year > 2100) {
    throw new ValidationError('period', 'Year must be between 2000 and 2100');
  }

  if (month < 1 || month > 12) {
    throw new ValidationError('period', 'Month must be between 01 and 12');
  }

  return trimmed;
}

/**
 * Validate obligation ID.
 *
 * @param obligationId - The obligation ID to validate
 * @returns Validated obligation ID
 * @throws ValidationError if obligation ID is invalid
 *
 * @example
 * ```typescript
 * const id = validateObligationId('OBL123456'); // 'OBL123456'
 * ```
 */
export function validateObligationId(obligationId: string): string {
  if (!obligationId) {
    throw new ValidationError('obligation_id', 'Obligation ID is required');
  }

  const trimmed = obligationId.trim();

  if (trimmed.length < 3) {
    throw new ValidationError('obligation_id', 'Obligation ID must be at least 3 characters');
  }

  return trimmed;
}

/**
 * Validate electronic slip number.
 *
 * @param slipNumber - The e-slip number to validate
 * @returns Validated slip number
 * @throws ValidationError if slip number is invalid
 *
 * @example
 * ```typescript
 * const slip = validateEslipNumber('ESLIP123456789'); // 'ESLIP123456789'
 * ```
 */
export function validateEslipNumber(slipNumber: string): string {
  if (!slipNumber) {
    throw new ValidationError('slip_number', 'E-slip number is required');
  }

  const trimmed = slipNumber.trim();

  if (trimmed.length < 5) {
    throw new ValidationError('slip_number', 'E-slip number must be at least 5 characters');
  }

  return trimmed;
}

/**
 * Validate monetary amount.
 *
 * @param amount - The amount to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated amount
 * @throws ValidationError if amount is invalid
 *
 * @example
 * ```typescript
 * const amount = validateAmount(100.50); // 100.5
 * validateAmount(-10); // Throws ValidationError
 * ```
 */
export function validateAmount(amount: number, fieldName: string = 'amount'): number {
  if (amount === null || amount === undefined) {
    throw new ValidationError(fieldName, `${fieldName} is required`);
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new ValidationError(fieldName, `${fieldName} must be a number`);
  }

  if (amount < 0) {
    throw new ValidationError(fieldName, `${fieldName} must be positive`);
  }

  return amount;
}

/**
 * Validate date string format.
 *
 * Accepts ISO 8601 format (YYYY-MM-DD).
 *
 * @param dateString - The date string to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated date string
 * @throws ValidationError if date format is invalid
 *
 * @example
 * ```typescript
 * const date = validateDateString('2024-01-15'); // '2024-01-15'
 * ```
 */
export function validateDateString(dateString: string, fieldName: string = 'date'): string {
  if (!dateString) {
    throw new ValidationError(fieldName, `${fieldName} is required`);
  }

  const trimmed = dateString.trim();

  // Try to parse as ISO date
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new ValidationError(
      fieldName,
      `${fieldName} must be in YYYY-MM-DD format (e.g., 2024-01-15)`
    );
  }

  return trimmed;
}

/**
 * Validate email address format.
 *
 * @param email - Email address to validate
 * @returns Normalized email (lowercase, stripped)
 * @throws ValidationError if email format is invalid
 *
 * @example
 * ```typescript
 * const email = validateEmail('user@example.com'); // 'user@example.com'
 * const normalized = validateEmail('User@Example.COM'); // 'user@example.com'
 * ```
 */
export function validateEmail(email: string): string {
  if (!email) {
    throw new ValidationError('email', 'Email is required');
  }

  const normalized = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    throw new ValidationError('email', 'Invalid email format');
  }

  return normalized;
}

/**
 * Validate phone number format (Kenyan format).
 *
 * Accepts formats:
 * - +254XXXXXXXXX (international)
 * - 07XXXXXXXX or 01XXXXXXXX (local)
 * - 2547XXXXXXXX or 2541XXXXXXXX (without +)
 *
 * @param phoneNumber - Phone number to validate
 * @returns Normalized phone number in international format (+254XXXXXXXXX)
 * @throws ValidationError if phone number format is invalid
 *
 * @example
 * ```typescript
 * const phone = validatePhoneNumber('+254712345678'); // '+254712345678'
 * const normalized = validatePhoneNumber('0712345678'); // '+254712345678'
 * ```
 */
export function validatePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    throw new ValidationError('phone_number', 'Phone number is required');
  }

  // Remove whitespace and hyphens
  let normalized = phoneNumber.replace(/[\s-]/g, '');

  // Convert to international format
  if (normalized.startsWith('0')) {
    // Local format (0712345678 -> +254712345678)
    normalized = '+254' + normalized.substring(1);
  } else if (normalized.startsWith('254') && !normalized.startsWith('+')) {
    // International without + (254712345678 -> +254712345678)
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+254')) {
    throw new ValidationError(
      'phone_number',
      'Phone number must be in Kenyan format (+254XXXXXXXXX or 07XXXXXXXX)'
    );
  }

  // Validate final format
  if (!KENYAN_PHONE_REGEX.test(normalized)) {
    throw new ValidationError(
      'phone_number',
      'Invalid Kenyan phone number format (must be +254 followed by 9 digits starting with 7 or 1)'
    );
  }

  return normalized;
}

/**
 * Mask PIN number for logging purposes.
 *
 * Shows only first 3 and last 2 characters.
 *
 * @param pinNumber - PIN number to mask
 * @returns Masked PIN number
 *
 * @example
 * ```typescript
 * const masked = maskPin('P051234567A'); // 'P05******7A'
 * ```
 */
export function maskPin(pinNumber: string): string {
  if (!pinNumber || pinNumber.length < 5) {
    return '***';
  }

  return `${pinNumber.substring(0, 3)}${'*'.repeat(pinNumber.length - 5)}${pinNumber.substring(pinNumber.length - 2)}`;
}

/**
 * Mask sensitive data for logging.
 *
 * @param data - Sensitive data to mask
 * @param visibleChars - Number of characters to keep visible at the end
 * @returns Masked data
 *
 * @example
 * ```typescript
 * const masked = maskSensitiveData('api_key_12345678', 4); // '************5678'
 * ```
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) {
    return '*'.repeat(data?.length || 0);
  }

  return '*'.repeat(data.length - visibleChars) + data.substring(data.length - visibleChars);
}
