/**
 * Batch Processing Example
 *
 * This example demonstrates how to verify multiple PINs concurrently
 * for improved performance.
 */

import { KraClient, KraConnectError } from '../src';
import 'dotenv/config';

async function verifyMultiplePins() {
  const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

  // PINs to verify
  const pinsToVerify = [
    'P051234567A',
    'P051234567B',
    'P051234567C',
    'P051234567D',
    'P051234567E',
  ];

  console.log(`Verifying ${pinsToVerify.length} PINs concurrently...`);
  console.log('-'.repeat(80));

  try {
    // Use batch method for concurrent verification
    const results = await client.verifyPinsBatch(pinsToVerify);

    // Process results
    console.log('\nResults:');
    console.log('-'.repeat(80));

    results.forEach((result) => {
      if (result.isValid) {
        console.log(`✓ ${result.pinNumber}: ${result.taxpayerName} (${result.status})`);
      } else {
        console.log(`✗ ${result.pinNumber}: Invalid PIN`);
        if (result.errorMessage) {
          console.log(`  Error: ${result.errorMessage}`);
        }
      }
    });

    // Summary
    const validCount = results.filter((r) => r.isValid).length;
    console.log('-'.repeat(80));
    console.log(`Summary: ${validCount}/${pinsToVerify.length} valid PINs`);
  } catch (error) {
    console.error('Batch verification failed:', error);
  }
}

async function manualBatchWithErrorHandling() {
  const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

  const pins = ['P051234567A', 'INVALID_PIN', 'P051234567C'];

  console.log('\n\nManual Batch with Error Handling:');
  console.log('='.repeat(80));

  const results = await Promise.allSettled(pins.map((pin) => client.verifyPin(pin)));

  results.forEach((result, index) => {
    const pin = pins[index]!;
    if (result.status === 'fulfilled') {
      const data = result.value;
      console.log(`✓ ${pin}: ${data.taxpayerName}`);
    } else {
      console.log(`✗ ${pin}: ${result.reason.message}`);
    }
  });
}

async function main() {
  console.log('Example 1: Concurrent PIN Verification');
  console.log('='.repeat(80));
  await verifyMultiplePins();

  console.log('\n\nExample 2: Batch with Error Handling');
  console.log('='.repeat(80));
  await manualBatchWithErrorHandling();
}

main();
