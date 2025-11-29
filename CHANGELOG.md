# Changelog

All notable changes to the KRA-Connect Node.js SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-15

### Added
- Initial release of @kra-connect/node
- PIN verification functionality
- TCC (Tax Compliance Certificate) verification
- E-slip validation
- NIL return filing
- Taxpayer details retrieval
- Batch PIN verification support
- Comprehensive TypeScript type definitions
- Custom exception classes for error handling
- HTTP client with automatic retry logic using axios-retry
- Exponential backoff for failed requests
- Response caching with configurable TTL
- Token bucket rate limiting
- Input validation for all data formats
- Configuration management with environment variable support
- Logging support
- Complete JSDoc documentation
- Example applications demonstrating usage
- Jest testing configuration

### Features
- **Full TypeScript Support** - Complete type safety
- **Automatic Retry** - Configurable retry logic with exponential backoff
- **Response Caching** - In-memory caching to reduce API calls
- **Rate Limiting** - Token bucket algorithm to prevent rate limit errors
- **Error Handling** - Comprehensive custom exception classes
- **Validation** - Input validation for PINs, TCCs, dates, emails, phone numbers
- **Batch Operations** - Concurrent verification of multiple PINs
- **Environment Configuration** - Easy setup with .env files

### API Endpoints
- `verifyPin(pinNumber)` - Verify KRA PIN numbers
- `verifyTcc(tccNumber)` - Verify Tax Compliance Certificates
- `validateEslip(slipNumber)` - Validate electronic payment slips
- `fileNilReturn(request)` - File NIL returns
- `getTaxpayerDetails(pinNumber)` - Retrieve taxpayer information
- `verifyPinsBatch(pinNumbers)` - Batch PIN verification

### Configuration Options
- API key management
- Custom base URL
- Request timeout configuration
- Retry configuration (max attempts, delays)
- Cache configuration (enabled, TTL, max size)
- Rate limit configuration (max requests, window)
- Custom user agent

### Developer Tools
- TypeScript declarations
- Jest test framework setup
- ESLint configuration
- Prettier code formatting
- Example applications
- Comprehensive README

## [0.0.1] - 2025-01-14

### Added
- Project initialization
- Basic project structure
- Package.json configuration
- TypeScript configuration

---

[Unreleased]: https://github.com/your-org/kra-connect/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/kra-connect/releases/tag/v0.1.0
[0.0.1]: https://github.com/your-org/kra-connect/releases/tag/v0.0.1
