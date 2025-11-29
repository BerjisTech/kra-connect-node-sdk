/**
 * Error Handling Example
 *
 * This example demonstrates comprehensive error handling
 * with the KRA-Connect SDK.
 */

import {
  KraClient,
  KraConnectError,
  InvalidPinFormatError,
  ApiAuthenticationError,
  ApiTimeoutError,
  RateLimitExceededError,
  ApiError,
} from '../src';
import 'dotenv/config';

async function demonstrateErrorHandling() {
  const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

  // Example 1: Invalid PIN format
  console.log('Example 1: Invalid PIN Format');
  console.log('-'.repeat(80));
  try {
    await client.verifyPin('INVALID123');
  } catch (error) {
    if (error instanceof InvalidPinFormatError) {
      console.log(`✗ Format Error: ${error.message}`);
    }
  }

  // Example 2: Handling all error types
  console.log('\n\nExample 2: Comprehensive Error Handling');
  console.log('-'.repeat(80));

  const testPins = ['P051234567A', 'INVALID'];

  for (const pin of testPins) {
    try {
      console.log(`\nTrying to verify: ${pin}`);
      const result = await client.verifyPin(pin);
      console.log(`✓ Success: ${result.taxpayerName}`);
    } catch (error) {
      if (error instanceof InvalidPinFormatError) {
        console.error(`  ✗ Invalid Format: ${error.message}`);
      } else if (error instanceof ApiAuthenticationError) {
        console.error(`  ✗ Authentication Failed: ${error.message}`);
        console.error(`  Please check your API key`);
      } else if (error instanceof ApiTimeoutError) {
        console.error(`  ✗ Request Timed Out: ${error.message}`);
        console.error(`  Timeout: ${error.timeout}ms, Endpoint: ${error.endpoint}`);
      } else if (error instanceof RateLimitExceededError) {
        console.error(`  ✗ Rate Limit Exceeded: ${error.message}`);
        console.error(`  Retry after: ${error.retryAfter} seconds`);

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, error.retryAfter * 1000));
        console.log(`  Retrying after ${error.retryAfter} seconds...`);
        // Retry logic here
      } else if (error instanceof ApiError) {
        console.error(`  ✗ API Error: ${error.message}`);
        if (error.statusCode) {
          console.error(`  Status Code: ${error.statusCode}`);
        }
        if (error.responseData) {
          console.error(`  Response Data:`, error.responseData);
        }
      } else if (error instanceof KraConnectError) {
        console.error(`  ✗ SDK Error: ${error.message}`);
      } else {
        console.error(`  ✗ Unexpected Error:`, error);
      }
    }
  }
}

async function demonstrateRetryLogic() {
  console.log('\n\nExample 3: Retry Logic with Error Handling');
  console.log('-'.repeat(80));

  const client = new KraClient({
    apiKey: process.env.KRA_API_KEY!,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
    },
  });

  try {
    console.log('Attempting PIN verification with retry logic...');
    const result = await client.verifyPin('P051234567A');
    console.log(`✓ Success: ${result.taxpayerName}`);
  } catch (error) {
    console.error('Failed after all retry attempts:', error);
  }
}

async function demonstrateGracefulDegradation() {
  console.log('\n\nExample 4: Graceful Degradation');
  console.log('-'.repeat(80));

  const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

  async function verifyWithFallback(pin: string) {
    try {
      return await client.verifyPin(pin);
    } catch (error) {
      console.warn(`Primary verification failed for ${pin}, using fallback...`);

      // Return a default "unknown" result instead of failing
      return {
        pinNumber: pin,
        isValid: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        verifiedAt: new Date().toISOString(),
      };
    }
  }

  const pins = ['P051234567A', 'INVALID', 'P051234567C'];

  for (const pin of pins) {
    const result = await verifyWithFallback(pin);
    console.log(`${pin}: ${result.isValid ? '✓ Valid' : '✗ Invalid/Error'}`);
  }
}

async function main() {
  try {
    await demonstrateErrorHandling();
    await demonstrateRetryLogic();
    await demonstrateGracefulDegradation();
  } catch (error) {
    console.error('Main execution failed:', error);
  }
}

main();
