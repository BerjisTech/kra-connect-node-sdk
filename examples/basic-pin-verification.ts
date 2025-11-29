/**
 * Basic PIN Verification Example
 *
 * This example demonstrates how to verify a single KRA PIN number
 * using the KRA-Connect Node.js SDK.
 */

import { KraClient, KraConnectError } from '../src';
import 'dotenv/config';

async function main() {
  // Initialize the client with API key from environment
  const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

  // PIN to verify
  const pinNumber = 'P051234567A';

  try {
    // Verify the PIN
    console.log(`Verifying PIN: ${pinNumber}...`);
    const result = await client.verifyPin(pinNumber);

    // Check if PIN is valid
    if (result.isValid) {
      console.log('✓ PIN is valid!');
      console.log(`  Taxpayer Name: ${result.taxpayerName}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Business Type: ${result.businessType}`);
      console.log(`  Registration Date: ${result.registrationDate}`);
      console.log(`  Email: ${result.email}`);
      console.log(`  Phone: ${result.phoneNumber}`);
    } else {
      console.log('✗ PIN is not valid');
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
    }
  } catch (error) {
    if (error instanceof KraConnectError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Unexpected error: ${error}`);
    }
  }
}

main();
