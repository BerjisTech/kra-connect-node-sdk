# @kra-connect/node

> Official Node.js/TypeScript SDK for Kenya Revenue Authority's GavaConnect API

[![npm version](https://badge.fury.io/js/%40kra-connect%2Fnode.svg)](https://www.npmjs.com/package/@kra-connect/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Features

- ✅ **Full TypeScript Support** - Complete type definitions
- ✅ **PIN Verification** - Verify KRA PIN numbers
- ✅ **TCC Verification** - Check Tax Compliance Certificates
- ✅ **e-Slip Validation** - Validate electronic payment slips
- ✅ **NIL Returns** - File NIL returns programmatically
- ✅ **Taxpayer Details** - Retrieve taxpayer information
- ✅ **Automatic Retry** - Built-in retry logic with exponential backoff
- ✅ **Response Caching** - Configurable caching for improved performance
- ✅ **Rate Limiting** - Protect against rate limit errors
- ✅ **Axios-Based** - Built on the popular Axios HTTP client

## Installation

```bash
npm install @kra-connect/node
```

Or with Yarn:

```bash
yarn add @kra-connect/node
```

Or with pnpm:

```bash
pnpm add @kra-connect/node
```

## Quick Start

### Basic Usage

```typescript
import { KraClient } from '@kra-connect/node';

// Initialize the client
const client = new KraClient({ apiKey: 'your-api-key' });

// Verify a PIN
const result = await client.verifyPin('P051234567A');

if (result.isValid) {
  console.log(`Taxpayer: ${result.taxpayerName}`);
  console.log(`Status: ${result.status}`);
} else {
  console.log(`Invalid PIN: ${result.errorMessage}`);
}
```

### Using Environment Variables

Create a `.env` file:

```env
KRA_API_KEY=your_api_key_here
KRA_API_BASE_URL=https://api.kra.go.ke/gavaconnect/v1
KRA_TIMEOUT=30000
```

Then use the client:

```typescript
import { KraClient, KraConfig } from '@kra-connect/node';
import 'dotenv/config';

// Automatically loads from environment variables
const client = new KraClient(KraConfig.fromEnv());

const result = await client.verifyPin('P051234567A');
```

### TypeScript Example

```typescript
import { KraClient, PinVerificationResult, KraConfig } from '@kra-connect/node';

const config: KraConfig = {
  apiKey: process.env.KRA_API_KEY!,
  timeout: 30000,
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
  },
};

const client = new KraClient(config);

async function verifySupplier(pin: string): Promise<void> {
  try {
    const result: PinVerificationResult = await client.verifyPin(pin);

    if (result.isValid) {
      console.log('✓ Valid supplier');
      console.log(`  Name: ${result.taxpayerName}`);
      console.log(`  Type: ${result.businessType}`);
    } else {
      console.log('✗ Invalid PIN');
    }
  } catch (error) {
    console.error('Verification failed:', error);
  }
}
```

## API Reference

### KraClient

The main client for interacting with the KRA GavaConnect API.

#### Constructor

```typescript
new KraClient(config: KraConfig)
```

#### Methods

##### `verifyPin(pinNumber: string): Promise<PinVerificationResult>`

Verify a KRA PIN number.

**Parameters:**
- `pinNumber` - The PIN to verify (format: P + 9 digits + letter)

**Returns:**
- `Promise<PinVerificationResult>` - Verification result with taxpayer details

**Example:**
```typescript
const result = await client.verifyPin('P051234567A');
```

##### `verifyTcc(tccNumber: string): Promise<TccVerificationResult>`

Verify a Tax Compliance Certificate.

**Parameters:**
- `tccNumber` - The TCC number to verify

**Returns:**
- `Promise<TccVerificationResult>` - TCC verification result

**Example:**
```typescript
const result = await client.verifyTcc('TCC123456');
console.log(`Valid until: ${result.expiryDate}`);
```

##### `validateEslip(slipNumber: string): Promise<EslipValidationResult>`

Validate an electronic payment slip.

**Parameters:**
- `slipNumber` - The e-slip number to validate

**Returns:**
- `Promise<EslipValidationResult>` - Validation result

##### `fileNilReturn(data: NilReturnRequest): Promise<NilReturnResult>`

File a NIL return for a taxpayer.

**Parameters:**
- `data.pinNumber` - Taxpayer's PIN
- `data.period` - Tax period (YYYYMM format)
- `data.obligationId` - Obligation identifier

**Returns:**
- `Promise<NilReturnResult>` - Filing result

**Example:**
```typescript
const result = await client.fileNilReturn({
  pinNumber: 'P051234567A',
  period: '202401',
  obligationId: 'OBL123456',
});
```

##### `getTaxpayerDetails(pinNumber: string): Promise<TaxpayerDetails>`

Retrieve detailed taxpayer information.

**Parameters:**
- `pinNumber` - Taxpayer's PIN

**Returns:**
- `Promise<TaxpayerDetails>` - Complete taxpayer information

### Configuration

#### KraConfig

```typescript
interface KraConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryConfig?: RetryConfig;
  cacheConfig?: CacheConfig;
  rateLimitConfig?: RateLimitConfig;
}
```

#### RetryConfig

```typescript
interface RetryConfig {
  maxAttempts?: number;       // Default: 3
  initialDelay?: number;      // Default: 1000ms
  maxDelay?: number;          // Default: 30000ms
  exponentialBase?: number;   // Default: 2
}
```

#### CacheConfig

```typescript
interface CacheConfig {
  enabled?: boolean;          // Default: true
  ttl?: number;              // Default: 3600 seconds
  maxSize?: number;          // Default: 1000
}
```

## Error Handling

```typescript
import {
  KraClient,
  InvalidPinFormatError,
  ApiAuthenticationError,
  ApiTimeoutError,
  RateLimitExceededError,
  ApiError,
} from '@kra-connect/node';

try {
  const result = await client.verifyPin('P051234567A');
} catch (error) {
  if (error instanceof InvalidPinFormatError) {
    console.error('Invalid PIN format:', error.message);
  } else if (error instanceof ApiAuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof ApiTimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof RateLimitExceededError) {
    console.error(`Rate limit exceeded. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ApiError) {
    console.error('API error:', error.message, error.statusCode);
  }
}
```

## Advanced Usage

### Batch Verification

```typescript
const pins = ['P051234567A', 'P051234567B', 'P051234567C'];

const results = await Promise.all(
  pins.map(pin => client.verifyPin(pin))
);

results.forEach((result, index) => {
  console.log(`${pins[index]}: ${result.isValid ? '✓' : '✗'}`);
});
```

### Custom Configuration

```typescript
const client = new KraClient({
  apiKey: process.env.KRA_API_KEY!,
  baseUrl: 'https://api.kra.go.ke/gavaconnect/v1',
  timeout: 60000, // 60 seconds
  retryConfig: {
    maxAttempts: 5,
    initialDelay: 2000,
    maxDelay: 60000,
  },
  cacheConfig: {
    enabled: true,
    ttl: 7200, // 2 hours
  },
  rateLimitConfig: {
    maxRequests: 200,
    windowSeconds: 60,
  },
});
```

### Middleware Integration

#### Express Middleware

```typescript
import express from 'express';
import { KraClient } from '@kra-connect/node';

const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

app.post('/verify-supplier', async (req, res) => {
  try {
    const { pin } = req.body;
    const result = await client.verifyPin(pin);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Fastify Plugin

```typescript
import Fastify from 'fastify';
import { KraClient } from '@kra-connect/node';

const fastify = Fastify();
const client = new KraClient({ apiKey: process.env.KRA_API_KEY! });

fastify.post('/verify-pin', async (request, reply) => {
  const { pin } = request.body as { pin: string };
  const result = await client.verifyPin(pin);
  return result;
});
```

## Examples

See the [examples](./examples) directory for more usage examples:

- [Basic PIN Verification](./examples/basic-pin-verification.ts)
- [Batch Processing](./examples/batch-processing.ts)
- [Error Handling](./examples/error-handling.ts)
- [Express Integration](./examples/express-integration.ts)
- [TypeScript Usage](./examples/typescript-usage.ts)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the package
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- **Documentation**: [https://docs.kra-connect.dev/node](https://docs.kra-connect.dev/node)
- **Issues**: [GitHub Issues](https://github.com/your-org/kra-connect/issues)
- **Discord**: [Join our community](https://discord.gg/kra-connect)
- **Email**: support@kra-connect.dev

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Disclaimer

This is an independent project and is not officially affiliated with or endorsed by the Kenya Revenue Authority.
